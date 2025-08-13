# Express.js ECS Transparent Proxy Implementation Guide

## Overview

This implementation provides an Express.js application designed to run on Amazon ECS that acts as a **transparent HTTP proxy**. Unlike traditional proxies that require special request formats, this proxy intercepts all incoming requests and forwards them directly to a target host while maintaining the same URL path, method, headers, and body. The primary purpose is to fix IP address issues for CORS purposes by providing a consistent, fixed IP address for outbound requests.

## Architecture

```
Your Application → ECS Transparent Proxy → Target API
   (any path)        (same path)         (fixed IP via NAT Gateway)
```

The application makes requests to the ECS proxy using the same API structure as the target API. The proxy transparently forwards everything to the actual target host with a consistent IP address.

## Key Features

### 1. Transparent Forwarding
- **Preserves original API structure**: Your code doesn't need to change
- **Path preservation**: `/api/v1/login` → `TARGET_HOST/api/v1/login`
- **Method preservation**: GET, POST, PUT, PATCH, DELETE all supported
- **Header forwarding**: All headers (except hop-by-hop) are forwarded
- **Body forwarding**: JSON, form data, raw data all supported
- **Query parameter preservation**: All URL parameters are maintained

### 2. No Axios Dependencies
- **Native Node.js HTTP/HTTPS**: Uses built-in modules for maximum reliability
- **No status code errors**: Never throws errors based on HTTP status codes
- **Better error handling**: More granular control over network errors
- **Improved performance**: No external HTTP library overhead

### 3. Configuration via Environment Variables
- **TARGET_HOST**: The base URL of the API you want to proxy to
- **PORT**: The port the proxy server runs on (default: 3000)

## Usage Example

### Before (Direct API calls):
```typescript
// Your original banking API code
async loginSystem(phone: string) {
    const response = await this.httpClient.post(`${this.host}${this.env}/oauth/access-token`, params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: this.loginBrendaBasic
        }
    });
    // ... rest of the code
}
```

### After (Through ECS Proxy):
```typescript
// Simply change the host to point to your ECS proxy
// Everything else stays exactly the same!
const proxyHost = 'https://your-ecs-proxy-url.com';

async loginSystem(phone: string) {
    const response = await this.httpClient.post(`${proxyHost}/${this.env}/oauth/access-token`, params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: this.loginBrendaBasic
        }
    });
    // ... rest of the code stays identical
}
```

### Configuration:
Set the `TARGET_HOST` environment variable in your ECS task to point to your actual API:
```bash
TARGET_HOST=https://api.sensedia.com  # Your actual banking API host
```

### How It Works:
1. Your app makes request to: `https://your-ecs-proxy.com/v1/oauth/access-token`
2. Proxy forwards to: `https://api.sensedia.com/v1/oauth/access-token`
3. Response is forwarded back unchanged
4. All requests come from ECS's fixed IP (via NAT Gateway)

## Implementation Details

### Security Features

1. **Helmet.js**: Security headers
2. **CORS**: Cross-origin resource sharing  
3. **Request Size Limits**: 10MB limit for payloads
4. **Header Sanitization**: Removes hop-by-hop headers
5. **Non-root User**: Container runs as non-root user

### Native HTTP Implementation

1. **No External Dependencies**: Uses Node.js built-in `http`/`https` modules
2. **Reliable Status Handling**: Never throws errors on non-200 status codes
3. **Direct Response Streaming**: Pipes response data directly for better performance
4. **Proper Error Categorization**: Distinguishes between network, timeout, and application errors

### Monitoring & Logging

1. **Morgan**: HTTP request logging
2. **Health Checks**: Built-in health endpoint with target host info
3. **Error Logging**: Comprehensive error tracking with timestamps
4. **Request/Response Logging**: Full visibility into proxy operations

## Deployment Guide

### Prerequisites

1. AWS CLI configured
2. Docker installed
3. ECR repository created
4. ECS cluster set up
5. IAM roles configured

### Step 1: Local Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Test the application
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpbin.org/get",
    "method": "GET"
  }'
```

### Step 2: Docker Build and Test

```bash
# Build Docker image
docker build -t rendimento-proxy .

# Run container locally
docker run -p 3000:3000 rendimento-proxy

# Or use docker-compose
docker-compose up
```

### Step 3: AWS ECS Deployment

1. **Create ECR Repository:**
```bash
aws ecr create-repository --repository-name rendimento-proxy
```

2. **Update Configuration:**
   - Edit `ecs-task-definition.json` with your AWS account details
   - Update `deploy.sh` with your specific configuration

3. **Deploy:**
```bash
./deploy.sh
```

### Step 4: ECS Service Configuration

Create an ECS service with:
- **Network Configuration**: VPC with NAT Gateway for consistent IP
- **Load Balancer**: Application Load Balancer for high availability
- **Auto Scaling**: Based on CPU/memory utilization
- **Security Groups**: Allow inbound traffic on port 3000

## Network Configuration for Fixed IP

To achieve a fixed IP address:

1. **VPC Setup:**
   - Private subnets for ECS tasks
   - Public subnets for NAT Gateway
   - Internet Gateway for outbound traffic

2. **NAT Gateway:**
   - Deployed in public subnet
   - Elastic IP attached for consistent outbound IP
   - Route table directs private subnet traffic through NAT

3. **ECS Service:**
   - Deploy in private subnets
   - All outbound traffic goes through NAT Gateway
   - Provides consistent IP for external API calls

## Monitoring and Maintenance

### CloudWatch Metrics

Monitor these key metrics:
- CPU and memory utilization
- Request count and latency
- Error rates
- Health check status

### Logging

Configure CloudWatch Logs for:
- Application logs
- ECS task logs
- Load balancer access logs

### Alerts

Set up CloudWatch alarms for:
- High error rates
- Resource utilization
- Health check failures

## Security Considerations

1. **Network Security:**
   - Use security groups to restrict access
   - Deploy in private subnets
   - Use VPC endpoints where possible

2. **Application Security:**
   - Input validation on all requests
   - Rate limiting (implement if needed)
   - SSL/TLS for all communications

3. **IAM Permissions:**
   - Least privilege access
   - Separate roles for different functions
   - Regular permission audits

## Performance Optimization

1. **Container Resources:**
   - Right-size CPU and memory
   - Use appropriate instance types
   - Monitor resource utilization

2. **Network Performance:**
   - Use placement groups if needed
   - Consider enhanced networking
   - Monitor network metrics

3. **Application Tuning:**
   - Adjust timeout values
   - Optimize connection pooling
   - Implement request queuing if needed

## Troubleshooting

### Common Issues

1. **Connection Timeouts:**
   - Check security group rules
   - Verify network connectivity
   - Increase timeout values

2. **High Memory Usage:**
   - Monitor request sizes
   - Check for memory leaks
   - Optimize payload handling

3. **CORS Issues:**
   - Verify proxy is forwarding headers correctly
   - Check target API CORS configuration
   - Confirm consistent IP usage

### Debugging

1. **Application Logs:**
```bash
aws logs tail /ecs/rendimento-proxy --follow
```

2. **ECS Task Status:**
```bash
aws ecs describe-tasks --cluster rendimento-cluster --tasks task-id
```

3. **Health Checks:**
```bash
curl https://your-service-url/health
```

## Cost Optimization

1. **Right-sizing:**
   - Monitor actual resource usage
   - Adjust task definitions accordingly
   - Use Spot instances where appropriate

2. **Auto Scaling:**
   - Scale based on demand
   - Set appropriate scaling policies
   - Monitor scaling events

3. **Network Costs:**
   - Minimize cross-AZ traffic
   - Optimize data transfer
   - Consider VPC endpoints for AWS services

## Conclusion

This Express.js proxy service provides a robust solution for fixing IP addresses when making HTTP requests from Lambda functions. The containerized approach with ECS ensures scalability, reliability, and consistent network behavior while maintaining security and performance best practices.

The implementation includes comprehensive error handling, monitoring capabilities, and production-ready deployment configurations to ensure reliable operation in AWS environments.
