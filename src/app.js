const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { url } = require('inspector');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    proxyPattern: 'Use: /{url-encoded-target-url}'
  });
});

// Dynamic proxy middleware for all routes except /health
app.use('*', async (req, res) => {
  // Skip health check
  if (req.originalUrl === '/health') {
    return;
  }

  try {
    // Extract the URL-encoded target URL from the path
    // Format: /{url-encoded-target-url}
    console.log(`[${new Date().toISOString()}] Extracting target URL from: ${req.originalUrl}`);
    const urlPath = req.originalUrl.startsWith('/') ? req.originalUrl.slice(1) : req.originalUrl;
    const targetBaseUrl = urlPath.split('/')[0] ?? urlPath;
    console.log("Target Base URL:", targetBaseUrl);
    const targetPath = urlPath.includes("/") ? "/" + urlPath.split('/').slice(1).join('/') : '';
    console.log("Target Path:", targetPath);
    const targetBaseUrlDecoded = decodeURIComponent(targetBaseUrl);
    console.log("Target Base URL (decoded):", targetBaseUrlDecoded);

    if (!urlPath) {
      return res.status(400).json({
        error: 'Missing target URL',
        message: 'Request format should be: /{url-encoded-target-url}',
        example: '/https%3A%2F%2Fapi.example.com%2Fv1%2Fusers'
      });
    }

    // Decode the target URL
    let targetUrl;
    try {
      targetUrl = decodeURIComponent(urlPath);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL encoding',
        message: 'The target URL must be properly URL-encoded',
        received: urlPath
      });
    }

    // Validate that it's a proper URL
    console.log("Final Target URL:", targetBaseUrlDecoded + targetPath);
    let parsedUrl;
    try {
      parsedUrl = new URL(targetBaseUrlDecoded + targetPath);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid target URL',
        message: 'The decoded URL is not a valid URL',
        decoded: targetUrl
      });
    }

    // Only allow HTTP and HTTPS protocols for security
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        error: 'Invalid protocol',
        message: 'Only HTTP and HTTPS protocols are allowed',
        protocol: parsedUrl.protocol
      });
    }
    
    // Clean up request headers (remove hop-by-hop headers and host-specific headers)
    const forwardHeaders = { ...req.headers };
    delete forwardHeaders['host'];
    delete forwardHeaders['connection'];
    delete forwardHeaders['keep-alive'];
    delete forwardHeaders['proxy-authenticate'];
    delete forwardHeaders['proxy-authorization'];
    delete forwardHeaders['te'];
    delete forwardHeaders['trailers'];
    delete forwardHeaders['transfer-encoding'];
    delete forwardHeaders['upgrade'];
    delete forwardHeaders['x-forwarded-for'];
    delete forwardHeaders['x-forwarded-host'];
    delete forwardHeaders['x-forwarded-proto'];

    // Set the correct host header for the target
    forwardHeaders['host'] = parsedUrl.host;

    console.log(`[${new Date().toISOString()}] Proxying ${req.method} ${req.originalUrl} -> ${targetUrl}`);
    console.log(`[${new Date().toISOString()}] Target host: ${parsedUrl.host}`);

    // Prepare request body
    let requestBody = '';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body !== undefined) {
      if (typeof req.body === 'string') {
        requestBody = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        requestBody = req.body;
      } else {
        requestBody = JSON.stringify(req.body);
        if (!forwardHeaders['content-type']) {
          forwardHeaders['content-type'] = 'application/json';
        }
      }
      
      // Set content-length if we have a body
      if (requestBody) {
        forwardHeaders['content-length'] = Buffer.byteLength(requestBody);
      }
    }

    // Choose http or https module based on protocol
    const httpModule = parsedUrl.protocol === 'https:' ? https : http;
    
    // Configure request options
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: forwardHeaders,
      timeout: 30000
    };

    // Make the request using native Node.js HTTP/HTTPS
    const proxyRequest = httpModule.request(requestOptions, (proxyResponse) => {
      console.log(`[${new Date().toISOString()}] Response received - Status: ${proxyResponse.statusCode}, StatusMessage: ${proxyResponse.statusMessage}`);

      // Clean up response headers (remove hop-by-hop headers)
      const responseHeaders = { ...proxyResponse.headers };
      delete responseHeaders['connection'];
      delete responseHeaders['keep-alive'];
      delete responseHeaders['proxy-authenticate'];
      delete responseHeaders['proxy-authorization'];
      delete responseHeaders['te'];
      delete responseHeaders['trailers'];
      delete responseHeaders['transfer-encoding'];
      delete responseHeaders['upgrade'];

      // Forward the response status and headers
      res.status(proxyResponse.statusCode);
      Object.keys(responseHeaders).forEach(key => {
        res.set(key, responseHeaders[key]);
      });

      // Pipe the response data directly
      proxyResponse.pipe(res);
    });

    // Handle request errors
    proxyRequest.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Proxy request error:`, error.message);
      
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to complete'
        });
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(502).json({
          error: 'Bad Gateway',
          message: 'Unable to connect to the target server'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred while processing the request'
      });
    });

    // Handle request timeout
    proxyRequest.on('timeout', () => {
      console.error(`[${new Date().toISOString()}] Proxy request timeout`);
      proxyRequest.destroy();
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to complete'
        });
      }
    });

    // Write request body if present
    if (requestBody) {
      proxyRequest.write(requestBody);
    }

    // End the request
    proxyRequest.end();

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Proxy error:`, error.message);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred while processing the request'
      });
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Dynamic proxy server running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Health check available at: http://localhost:${PORT}/health`);
  console.log(`[${new Date().toISOString()}] Usage: /{url-encoded-target-url}`);
  console.log(`[${new Date().toISOString()}] Example: /https%3A%2F%2Fapi.example.com%2Fv1%2Fusers`);
});

module.exports = app;
