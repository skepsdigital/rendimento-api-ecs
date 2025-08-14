# Guia de Configuração Docker

Este documento explica a configuração Docker para o Serviço de Proxy HTTP/HTTPS e como usá-lo efetivamente.

## Visão Geral dos Arquivos Docker

### Dockerfile

O `Dockerfile` cria uma imagem de container otimizada para o serviço de proxy:

```dockerfile
# Usa imagem base Node.js 18 Alpine Linux (leve)
FROM node:18-alpine

# Define diretório de trabalho dentro do container
WORKDIR /app

# Copia arquivos de pacote primeiro (para melhor cache de camadas)
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --only=production --silent

# Copia código fonte da aplicação
COPY src/ ./src/

# Cria usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Altera propriedade do diretório da aplicação para usuário não-root
RUN chown -R nodejs:nodejs /app

# Muda para usuário não-root
USER nodejs

# Expõe a porta onde a aplicação executa
EXPOSE 3000

# Adiciona health check para monitorar saúde do container
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Inicia a aplicação
CMD ["npm", "start"]
```

#### Principais Funcionalidades Explicadas:

1. **Imagem Base**: `node:18-alpine`
   - Alpine Linux para tamanho mínimo (~40MB vs ~300MB para Node.js completo)
   - Node.js 18 LTS para estabilidade e segurança
   - Atualizações de segurança integradas

2. **Otimização de Camadas**:
   - Arquivos de pacote copiados primeiro para aproveitar cache de camadas Docker
   - Dependências instaladas antes da cópia do código
   - Rebuilds apenas quando dependências mudam

3. **Segurança**:
   - Usuário não-root (`nodejs:1001`) previne escalação de privilégios
   - Apenas dependências de produção instaladas
   - Superfície de ataque mínima com Alpine Linux

4. **Health Check**:
   - Monitoramento automático de saúde do container
   - Usa o endpoint `/health`
   - Intervalos e tentativas configuráveis

### Docker Compose

O `docker-compose.yml` fornece orquestração para fácil implantação:

```yaml
version: '3.8'

services:
  http-proxy:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: http-proxy-service
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Funcionalidades Explicadas:

1. **Configuração do Serviço**:
   - Serviço nomeado (`http-proxy`) para fácil referência
   - Nome do container para comandos Docker diretos
   - Mapeamento de portas (host:container)

2. **Variáveis de Ambiente**:
   - `NODE_ENV=production` para performance otimizada do Node.js
   - `PORT=3000` definido explicitamente para clareza

3. **Política de Reinício**:
   - `unless-stopped` reinicia automaticamente em caso de falha
   - Sobrevive a reinicializações do daemon Docker
   - Paradas manuais são respeitadas

4. **Monitoramento de Saúde**:
   - Health check externo usando `wget`
   - Intervalos de 30 segundos com timeout de 10 segundos
   - 3 tentativas antes de marcar como não saudável

5. **Logging**:
   - Logs estruturados JSON
   - Rotação de logs (10MB máx por arquivo, 3 arquivos total)
   - Previne problemas de espaço em disco

### .dockerignore

Otimiza contexto de build e segurança:

```ignore
# Dependências Node.js
node_modules/
npm-debug.log*

# Arquivos de ambiente
.env*

# Arquivos de sistema
.DS_Store
.git/

# Documentação
*.md

# Arquivos de teste
test-*.js
*.test.js

# Arquivos Docker
Dockerfile
docker-compose.yml
```

#### Benefícios:

- **Builds mais rápidos**: Exclui arquivos desnecessários
- **Contexto menor**: Reduz tempo de build e uso de rede
- **Segurança**: Previne inclusão de arquivos sensíveis
- **Consistência**: Garante builds limpos entre ambientes

## Exemplos de Uso

### Configuração de Desenvolvimento

```bash
# Clonar repositório
git clone <url-do-repositorio>
cd rendimento-api-ecs

# Construir e iniciar com Docker Compose
docker-compose up -d

# Verificar logs
docker-compose logs -f http-proxy

# Testar o serviço
curl "http://localhost:3000/https%3A%2F%2Fhttpbin.org/get"
```

### Implantação em Produção

```bash
# Construir para produção
docker-compose -f docker-compose.yml up -d

# Monitorar saúde
docker inspect --format='{{.State.Health.Status}}' http-proxy-service

# Atualizar implantação
docker-compose pull
docker-compose up -d
```

### Comandos Docker Diretos

```bash
# Construir imagem
docker build -t http-proxy:latest .

# Executar container
docker run -d \
  --name http-proxy \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --health-cmd="wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=3s \
  --health-retries=3 \
  http-proxy:latest

# Verificar status
docker ps
docker logs http-proxy
```

## Monitoramento e Manutenção

### Health Checks

Monitorar saúde do container:

```bash
# Verificar status de saúde
docker inspect --format='{{.State.Health.Status}}' http-proxy-service

# Ver logs de health check
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' http-proxy-service
```

### Gerenciamento de Logs

```bash
# Ver logs em tempo real
docker-compose logs -f

# Ver logs de serviço específico
docker-compose logs -f http-proxy

# Rotacionar logs manualmente
docker-compose down && docker-compose up -d
```

### Monitoramento de Recursos

```bash
# Uso de recursos do container
docker stats http-proxy-service

# Informações detalhadas do container
docker inspect http-proxy-service
```

## Customização

### Variáveis de Ambiente

Adicionar variáveis de ambiente personalizadas ao docker-compose.yml:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - REQUEST_TIMEOUT=30000
  - MAX_BODY_SIZE=10mb
```

### Health Check Personalizado

Modificar health check no docker-compose.yml:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Montagem de Volumes

Para arquivos de configuração:

```yaml
volumes:
  - ./config:/app/config:ro
  - ./logs:/app/logs
```

## Solução de Problemas

### Problemas Comuns

1. **Porta Já em Uso**:
   ```bash
   # Alterar mapeamento de porta
   ports:
     - "3001:3000"
   ```

2. **Falhas de Build**:
   ```bash
   # Limpar cache de build
   docker-compose build --no-cache
   ```

3. **Falhas de Health Check**:
   ```bash
   # Verificar logs da aplicação
   docker-compose logs http-proxy
   
   # Testar endpoint de saúde manualmente
   docker exec http-proxy-service wget -qO- http://localhost:3000/health
   ```

4. **Problemas de Performance**:
   ```bash
   # Monitorar uso de recursos
   docker stats
   
   # Aumentar limites de memória
   deploy:
     resources:
       limits:
         memory: 512M
   ```

## Melhores Práticas de Segurança

1. **Usuário Não-root**: Já implementado no Dockerfile
2. **Imagem Base Mínima**: Usando Alpine Linux
3. **Dependências de Produção**: Instalando apenas pacotes necessários
4. **Monitoramento de Saúde**: Detectando e recuperando de falhas
5. **Rotação de Logs**: Prevenindo problemas de espaço em disco
6. **Políticas de Reinício**: Recuperação automática de crashes

Esta configuração Docker fornece uma solução robusta, segura e de fácil manutenção para implantação do serviço de proxy HTTP/HTTPS.
