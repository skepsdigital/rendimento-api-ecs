# Serviço de Proxy HTTP/HTTPS

Um serviço de proxy Express.js leve que encaminha requisições HTTP/HTTPS para qualquer URL de destino. Este proxy é projetado para resolver problemas de CORS e atuar como um gateway para requisições de API, aceitando URLs de destino codificadas no caminho da requisição.

## Como Funciona

O proxy usa um padrão simples mas poderoso de codificação de URL onde a URL base do servidor de destino é codificada e colocada como o primeiro segmento do caminho da requisição:

```
/{url-base-codificada}/{caminho-destino}
```

### Fluxo da Requisição

1. **Construção da URL**: A URL base do servidor de destino (protocolo + host) é codificada em URL
2. **Combinação do Caminho**: A URL base codificada é combinada com o caminho de destino
3. **Encaminhamento da Requisição**: O proxy decodifica a URL base, reconstrói a URL de destino completa e encaminha a requisição
4. **Retransmissão da Resposta**: A resposta do servidor de destino é retransmitida de volta para o cliente

### Padrão de Codificação de URL

A chave para usar este proxy é entender como construir a URL da requisição:

1. **Extrair URL Base**: Da sua URL de destino, extraia a base (protocolo + hostname + porta)
2. **Codificar URL**: Aplique codificação de URL à URL base
3. **Anexar Caminho**: Adicione o caminho de destino após a URL base codificada

**Exemplo:**
```
URL de Destino: https://api.exemplo.com/v1/usuarios/123
URL Base:       https://api.exemplo.com
Codificada:     https%3A%2F%2Fapi.exemplo.com
Caminho:        /v1/usuarios/123
URL Proxy:      http://seu-proxy:3000/https%3A%2F%2Fapi.exemplo.com/v1/usuarios/123
```

## Início Rápido

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Iniciar o servidor:**
   ```bash
   npm start
   ```

3. **Testar o proxy:**
   ```bash
   # Requisição GET simples
   curl "http://localhost:3000/https%3A%2F%2Fhttpbin.org/get"
   
   # Requisição POST com dados JSON
   curl -X POST "http://localhost:3000/https%3A%2F%2Fhttpbin.org/post" \
     -H "Content-Type: application/json" \
     -d '{"mensagem": "Olá Mundo"}'
   ```

## Exemplos de Requisições

| URL de Destino | URL Base | Base Codificada | Caminho de Destino | URL Final do Proxy |
|----------------|----------|----------------|-------------------|-------------------|
| `https://httpbin.org/get` | `https://httpbin.org` | `https%3A%2F%2Fhttpbin.org` | `/get` | `http://localhost:3000/https%3A%2F%2Fhttpbin.org/get` |
| `https://api.github.com/users/octocat` | `https://api.github.com` | `https%3A%2F%2Fapi.github.com` | `/users/octocat` | `http://localhost:3000/https%3A%2F%2Fapi.github.com/users/octocat` |
| `http://localhost:8080/api/v1/dados` | `http://localhost:8080` | `http%3A%2F%2Flocalhost%3A8080` | `/api/v1/dados` | `http://localhost:3000/http%3A%2F%2Flocalhost%3A8080/api/v1/dados` |

## Implementação no Cliente

### JavaScript/Node.js

```javascript
function criarUrlProxy(urlDestino, urlBaseProxy = 'http://localhost:3000') {
  const url = new URL(urlDestino);
  const urlBase = `${url.protocol}//${url.host}`;
  const caminho = url.pathname + url.search;
  const urlBaseCodificada = encodeURIComponent(urlBase);
  return `${urlBaseProxy}/${urlBaseCodificada}${caminho}`;
}

// Uso
const urlDestino = 'https://api.exemplo.com/v1/usuarios?pagina=1';
const urlProxy = criarUrlProxy(urlDestino);

fetch(urlProxy, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer seu-token'
  }
})
.then(response => response.json())
.then(dados => console.log(dados));
```

### Python

```python
import urllib.parse
import requests

def criar_url_proxy(url_destino, url_base_proxy='http://localhost:3000'):
    parseada = urllib.parse.urlparse(url_destino)
    url_base = f"{parseada.scheme}://{parseada.netloc}"
    caminho = parseada.path + ('?' + parseada.query if parseada.query else '')
    url_base_codificada = urllib.parse.quote(url_base, safe='')
    return f"{url_base_proxy}/{url_base_codificada}{caminho}"

# Uso
url_destino = 'https://api.exemplo.com/v1/usuarios?pagina=1'
url_proxy = criar_url_proxy(url_destino)

response = requests.get(url_proxy, headers={
    'Content-Type': 'application/json',
    'Authorization': 'Bearer seu-token'
})
```

## Funcionalidades

- **Suporte a Protocolos Universais**: Servidores de destino HTTP e HTTPS
- **Suporte Completo a Métodos HTTP**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- **Preservação de Cabeçalhos**: Encaminha todos os cabeçalhos exceto cabeçalhos hop-by-hop
- **Manipulação de Corpo**: Suporta dados JSON, form data e dados binários
- **Parâmetros de Consulta**: Preserva todos os parâmetros de consulta das URLs de destino
- **Tratamento de Erros**: Respostas de erro abrangentes com mensagens claras
- **Segurança**: Validação de protocolo e sanitização de cabeçalhos
- **Performance**: Timeout de 30 segundos com pool de conexões
- **Pronto para CORS**: Suporte CORS integrado para uso em navegadores

## Considerações de Segurança

- Apenas protocolos HTTP e HTTPS são permitidos
- Cabeçalhos hop-by-hop são removidos por segurança
- Cabeçalhos Host são reescritos adequadamente para servidores de destino
- Timeout de requisição previne conexões pendentes
- Sem ataques de elevação de protocolo (ex: file://, ftp://)

## Implantação em Produção

### Variáveis de Ambiente

- `PORT` - Porta do servidor (padrão: 3000)
- `NODE_ENV` - Modo de ambiente (production/development)

### Implantação com Docker

O serviço inclui configuração Docker otimizada para fácil implantação:

#### Usando Docker Compose (Recomendado)

```bash
# Construir e iniciar o serviço
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar o serviço
docker-compose down
```

#### Usando Docker diretamente

```bash
# Construir a imagem
docker build -t http-proxy .

# Executar o container
docker run -d \
  --name http-proxy-service \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  http-proxy

# Ver logs
docker logs -f http-proxy-service
```

#### Detalhes da Configuração Docker

**Funcionalidades do Dockerfile:**
- **Otimização multi-estágio**: Usa Node.js 18 Alpine para tamanho mínimo da imagem
- **Cache de camadas**: Arquivos de pacote copiados primeiro para melhor performance de build
- **Segurança**: Executa como usuário não-root (nodejs:1001)
- **Health checks**: Monitoramento de saúde integrado via endpoint `/health`
- **Pronto para produção**: Instala apenas dependências de produção

**Funcionalidades do Docker Compose:**
- **Nomenclatura de serviço**: Nomenclatura clara de serviço (`http-proxy`)
- **Monitoramento de saúde**: Health checks automáticos a cada 30 segundos
- **Política de reinício**: Reinicia automaticamente em caso de falha
- **Logging**: Rotação de logs configurada (10MB máx, 3 arquivos)
- **Ambiente**: Variáveis de ambiente de produção

### Implantação em Servidor

O proxy é projetado para executar em qualquer ambiente de servidor. Simplesmente:

1. Clone o repositório
2. Instale as dependências com `npm install`
3. Inicie com `npm start` ou use um gerenciador de processos como PM2
4. Configure proxy reverso (nginx, Apache) se necessário

## Tratamento de Erros

O proxy retorna respostas de erro JSON estruturadas:

- **400 Bad Request**: Codificação de URL inválida ou URL de destino ausente
- **408 Request Timeout**: Requisição excedeu timeout de 30 segundos
- **502 Bad Gateway**: Não é possível conectar ao servidor de destino
- **500 Internal Server Error**: Erros inesperados do proxy

Exemplo de resposta de erro:
```json
{
  "error": "Codificação de URL inválida",
  "message": "A URL de destino deve ser adequadamente codificada em URL",
  "received": "url-invalida"
}
```

## Monitoramento

O serviço inclui um endpoint de health check em `/health` para monitoramento e health checks de load balancer.
