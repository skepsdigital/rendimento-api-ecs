const http = require('http');

// Test the dynamic URL-encoded proxy functionality
async function testDynamicProxy() {
  console.log('Testing dynamic URL-encoded proxy...');

  // Test cases with different target URLs
  const testCases = [
    {
      name: 'GET request to httpbin.org',
      method: 'GET',
      targetUrl: 'https://httpbin.org/get?test=123',
      headers: {
        'User-Agent': 'Dynamic-Proxy-Test/1.0'
      }
    },
    {
      name: 'POST request to httpbin.org',
      method: 'POST',
      targetUrl: 'https://httpbin.org/post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello from dynamic proxy',
        timestamp: new Date().toISOString()
      })
    },
    {
      name: 'Banking API simulation (your use case)',
      method: 'POST',
      targetUrl: 'https://api3.rendimento.com.br/v1/oauth/access-token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic dGVzdDp0ZXN0'
      },
      body: 'grant_type=client_credentials'
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n--- Testing: ${testCase.name} ---`);
      
      // URL encode the target URL
      const encodedUrl = encodeURIComponent(testCase.targetUrl);
      console.log(`Target URL: ${testCase.targetUrl}`);
      console.log(`Encoded URL: ${encodedUrl}`);
      
      const result = await makeRequest({
        method: testCase.method,
        path: `/${encodedUrl}`,
        headers: testCase.headers,
        body: testCase.body
      });

      console.log(`✅ Status: ${result.statusCode}`);
      console.log(`✅ Response received: ${result.data.length} characters`);
      
      // Check if it's a successful proxy request
      if (result.statusCode >= 200 && result.statusCode < 300) {
        console.log(`✅ Successfully proxied to target`);
      } else if (result.statusCode >= 400) {
        console.log(`⚠️  Target returned error status: ${result.statusCode}`);
        console.log(`Response: ${result.data.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error.message);
    }
  }

  // Test error cases
  console.log(`\n--- Testing Error Cases ---`);
  
  const errorTestCases = [
    {
      name: 'Missing URL',
      path: '/',
      expectedStatus: 400
    },
    {
      name: 'Invalid URL encoding',
      path: '/invalid%url%encoding',
      expectedStatus: 400
    },
    {
      name: 'Invalid URL format',
      path: '/' + encodeURIComponent('not-a-url'),
      expectedStatus: 400
    },
    {
      name: 'Invalid protocol',
      path: '/' + encodeURIComponent('ftp://example.com/file'),
      expectedStatus: 400
    }
  ];

  for (const testCase of errorTestCases) {
    try {
      console.log(`\n--- Testing: ${testCase.name} ---`);
      
      const result = await makeRequest({
        method: 'GET',
        path: testCase.path,
        headers: {}
      });

      if (result.statusCode === testCase.expectedStatus) {
        console.log(`✅ Correctly returned status ${result.statusCode}`);
      } else {
        console.log(`❌ Expected ${testCase.expectedStatus}, got ${result.statusCode}`);
      }
      
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error.message);
    }
  }

  console.log('\n🏁 Testing completed');
}

function makeRequest({ method, path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      req.write(body);
    }
    
    req.end();
  });
}

// Helper function to generate encoded URLs for your banking API
function generateBankingAPIUrls() {
  console.log('\n=== Banking API URL Examples ===');
  
  const baseHost = 'https://api3.rendimento.com.br';
  const endpoints = [
    '/v1/oauth/access-token',
    '/v1/ibautenticacao/v1/usuarios-externos-brenda/123',
    '/v1/ibautenticacao/v2/contas-correntes?cpf=encoded-cpf',
    '/v1/ibsaldoextrato/v2/saldos/usuario',
    '/v1/ibpix/v2/chaves-enderecamentos-externo?chave=encoded-key&tipoChave=4'
  ];

  endpoints.forEach(endpoint => {
    const fullUrl = baseHost + endpoint;
    const encodedUrl = encodeURIComponent(fullUrl);
    console.log(`\nOriginal: ${fullUrl}`);
    console.log(`Encoded:  /${encodedUrl}`);
    console.log(`Usage:    curl -X POST "http://your-proxy.com/${encodedUrl}" -H "Authorization: Bearer token"`);
  });
}

// Only run test if this script is executed directly
if (require.main === module) {
  testDynamicProxy()
    .then(() => generateBankingAPIUrls())
    .catch(console.error);
}

module.exports = { testDynamicProxy, makeRequest, generateBankingAPIUrls };
