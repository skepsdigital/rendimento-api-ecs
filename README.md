# rendimento-api-ecs

ECS proxy service to fix IP addresses for requests made by Lambda functions, solving CORS issues by providing a consistent outbound IP address.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run locally:**
   ```bash
   npm run dev
   ```

3. **Test the proxy:**
   ```bash
   curl -X POST http://localhost:3000/proxy 
     -H "Content-Type: application/json" 
     -d '{
       "url": "https://httpbin.org/get",
       "method": "GET"
     }'
   ```

4. **Deploy to ECS:**
   ```bash
   ./deploy.sh
   ```

## Documentation

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for detailed implementation instructions, architecture overview, and deployment guide.

## API Endpoints

- `POST /proxy` - Main proxy endpoint
- `GET /health` - Health check endpoint

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)

## Docker

```bash
docker build -t rendimento-proxy .
docker run -p 3000:3000 rendimento-proxy
```
