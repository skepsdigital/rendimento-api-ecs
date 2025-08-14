# Guia de Implementação do Proxy Dinâmico Express.js

## Visão Geral

Esta implementação fornece uma aplicação Express.js projetada para executar em servidor que atua como um **proxy HTTP dinâmico**. O proxy aceita URLs de destino codificadas em URL como parte do caminho da requisição, permitindo fazer proxy para qualquer URL de destino dinamicamente. O objetivo principal é corrigir problemas de endereço IP para fins de CORS, fornecendo um endereço IP consistente e fixo para requisições de saída.

## Arquitetura

```
Sua Aplicação → Proxy Dinâmico → Qualquer API de Destino
/{destino-codificado}    (decodificar & encaminhar)    (IP fixo via Gateway NAT)
```

A aplicação faz requisições para o proxy com URLs de destino codificadas em URL. O proxy decodifica a URL e encaminha a requisição para o destino real com um endereço IP consistente.

## Padrão de Requisição

**Formato:** `urlbaseproxy/{url-destino-codificada-em-url}`

Onde:
- `urlbaseproxy` é a URL do seu proxy
- `{url-destino-codificada-em-url}` é a URL de destino completa (incluindo protocolo, host, caminho e parâmetros de consulta) que foi codificada em URL

## Principais Funcionalidades

### 1. URLs de Destino Dinâmicas
- **Nenhuma configuração necessária**: Qualquer URL HTTP/HTTPS válida pode ser proxificada
- **Codificação completa de URL**: URL de destino inclui protocolo, host, caminho e parâmetros de consulta
- **Validação de segurança**: Apenas protocolos HTTP e HTTPS são permitidos
- **Validação de URL**: Garante que URLs de destino sejam adequadamente formatadas

### 2. Encaminhamento Transparente
- **Preservação de método**: GET, POST, PUT, PATCH, DELETE todos suportados
- **Encaminhamento de cabeçalhos**: Todos os cabeçalhos (exceto hop-by-hop) são encaminhados
- **Encaminhamento de corpo**: Dados JSON, form data, dados brutos todos suportados
- **Preservação de parâmetros de consulta**: Todos os parâmetros de URL na URL de destino são mantidos

### 3. Sem Dependências Externas
- **HTTP/HTTPS nativo do Node.js**: Usa módulos integrados para máxima confiabilidade
- **Sem erros de código de status**: Nunca lança erros baseados em códigos de status HTTP
- **Melhor tratamento de erros**: Controle mais granular sobre erros de rede
- **Performance melhorada**: Sem overhead de biblioteca HTTP externa

## Exemplo de Uso

### Integração com API Bancária:

```typescript
// Seu código original de API bancária:
const response = await this.httpClient.post(
  `${this.host}${this.env}/oauth/access-token`, 
  params, 
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: this.loginBrendaBasic } }
);

// Usando o proxy dinâmico:
const targetUrl = `${this.host}${this.env}/oauth/access-token`;
const encodedUrl = encodeURIComponent(targetUrl);
const proxyUrl = `https://seu-proxy.com/${encodedUrl}`;

const response = await this.httpClient.post(
  proxyUrl,
  params,
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: this.loginBrendaBasic } }
);
```

### Exemplos de Codificação de URL:

```javascript
// URLs originais
const originalUrls = [
  'https://api3.rendimento.com.br/v1/oauth/access-token',
  'https://api3.rendimento.com.br/v1/ibautenticacao/v2/contas-correntes?cpf=cpf-codificado',
  'https://api3.rendimento.com.br/v1/ibsaldoextrato/v2/saldos/usuario'
];

// Codificadas para proxy
const proxyUrls = originalUrls.map(url => {
  const encoded = encodeURIComponent(url);
  return `https://seu-proxy.com/${encoded}`;
});

// Resultados:
// https://seu-proxy.com/https%3A%2F%2Fapi3.rendimento.com.br%2Fv1%2Foauth%2Faccess-token
// https://seu-proxy.com/https%3A%2F%2Fapi3.rendimento.com.br%2Fv1%2Fibautenticacao%2Fv2%2Fcontas-correntes%3Fcpf%3Dcpf-codificado
// https://seu-proxy.com/https%3A%2F%2Fapi3.rendimento.com.br%2Fv1%2Fibsaldoextrato%2Fv2%2Fsaldos%2Fusuario
```

### Função Auxiliar para Sua Aplicação:

```typescript
class BankingAPIProxy {
  private proxyBaseUrl: string;
  private targetHost: string;

  constructor(proxyBaseUrl: string, targetHost: string) {
    this.proxyBaseUrl = proxyBaseUrl;
    this.targetHost = targetHost;
  }

  private buildProxyUrl(path: string): string {
    const targetUrl = `${this.targetHost}${path}`;
    const encodedUrl = encodeURIComponent(targetUrl);
    return `${this.proxyBaseUrl}/${encodedUrl}`;
  }

  async loginSystem(phone: string) {
    const targetPath = `${this.env}/oauth/access-token`;
    const proxyUrl = this.buildProxyUrl(targetPath);
    
    const response = await this.httpClient.post(proxyUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.loginBrendaBasic
      }
    });
    // ... resto do seu código permanece igual
  }

  async getAccounts(phone: string, cpf: string) {
    const secureCpf = this.cryptoClient.encrypt(cpf);
    const targetPath = `/ibautenticacao/${this.version}/contas-correntes?${secureCpf}`;
    const proxyUrl = this.buildProxyUrl(targetPath);
    
    const response = await this.httpClient.get(proxyUrl, {
      headers: {
        access_token: this.sensediaToken?.access_token,
        client_id: this.clientId
      }
    });
    // ... resto do seu código permanece igual
  }
}
```

## Detalhes de Implementação

### Funcionalidades de Segurança

1. **Helmet.js**: Cabeçalhos de segurança
2. **CORS**: Compartilhamento de recursos entre origens
3. **Limites de tamanho de requisição**: Limite de 10MB para payloads
4. **Sanitização de cabeçalhos**: Remove cabeçalhos hop-by-hop
5. **Usuário não-root**: Container executa como usuário não-root

### Implementação HTTP Nativa

1. **Sem dependências externas**: Usa módulos integrados `http`/`https` do Node.js
2. **Tratamento confiável de status**: Nunca lança erros em códigos de status não-200
3. **Streaming direto de resposta**: Canaliza dados de resposta diretamente para melhor performance
4. **Categorização adequada de erros**: Distingue entre erros de rede, timeout e aplicação

### Monitoramento e Logging

1. **Morgan**: Logging de requisições HTTP
2. **Health Checks**: Endpoint de saúde integrado com informações do host de destino
3. **Logging de erros**: Rastreamento abrangente de erros com timestamps
4. **Logging de requisição/resposta**: Visibilidade completa das operações do proxy

## Guia de Implantação

### Pré-requisitos

1. Node.js instalado
2. Docker instalado (opcional)
3. Servidor configurado

### Passo 1: Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Executar localmente
npm run dev

# Testar a aplicação
curl -X GET "http://localhost:3000/https%3A%2F%2Fhttpbin.org%2Fget"
```

### Passo 2: Build e Teste com Docker

```bash
# Construir imagem Docker
docker build -t proxy-http .

# Executar container localmente
docker run -p 3000:3000 proxy-http

# Ou usar docker-compose
docker-compose up
```

### Passo 3: Implantação em Servidor

1. **Implantação Direta:**
```bash
# Clonar repositório
git clone <seu-repositorio>
cd rendimento-api-ecs

# Instalar dependências
npm install

# Iniciar em produção
npm start
```

2. **Com PM2 (Recomendado):**
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start src/app.js --name "http-proxy"

# Configurar para iniciar no boot
pm2 startup
pm2 save
```

### Passo 4: Configuração de Proxy Reverso (Opcional)

**Nginx:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Configuração de Rede para IP Fixo

Para alcançar um endereço IP fixo em ambiente de servidor:

1. **Configuração VPS/Servidor Dedicado:**
   - Use um servidor com IP estático
   - Configure regras de firewall adequadas
   - Use proxy reverso se necessário

2. **Configuração de Rede:**
   - Configure interfaces de rede adequadamente
   - Use NAT se executando em container
   - Configure roteamento se necessário

## Monitoramento e Manutenção

### Métricas Importantes

Monitore estas métricas principais:
- Utilização de CPU e memória
- Contagem de requisições e latência
- Taxas de erro
- Status de health check

### Logging

Configure logs para:
- Logs da aplicação
- Logs de acesso
- Logs de erro

### Alertas

Configure alertas para:
- Altas taxas de erro
- Utilização de recursos
- Falhas de health check

## Considerações de Segurança

1. **Segurança de Rede:**
   - Use firewalls para restringir acesso
   - Configure SSL/TLS adequadamente
   - Use VPN se necessário

2. **Segurança da Aplicação:**
   - Validação de entrada em todas as requisições
   - Rate limiting (implemente se necessário)
   - SSL/TLS para todas as comunicações

3. **Segurança do Servidor:**
   - Mantenha o sistema operacional atualizado
   - Use usuários não-privilegiados
   - Auditorias regulares de segurança

## Otimização de Performance

1. **Recursos do Servidor:**
   - Dimensione CPU e memória adequadamente
   - Use tipos de instância apropriados
   - Monitore utilização de recursos

2. **Performance de Rede:**
   - Otimize configurações de rede
   - Use CDN se aplicável
   - Monitore métricas de rede

3. **Tuning da Aplicação:**
   - Ajuste valores de timeout
   - Otimize pool de conexões
   - Implemente fila de requisições se necessário

## Solução de Problemas

### Problemas Comuns

1. **Timeouts de Conexão:**
   - Verifique regras de firewall
   - Verifique conectividade de rede
   - Aumente valores de timeout

2. **Alto uso de memória:**
   - Monitore tamanhos de requisição
   - Verifique vazamentos de memória
   - Otimize manipulação de payload

3. **Problemas de CORS:**
   - Verifique se proxy está encaminhando cabeçalhos corretamente
   - Verifique configuração CORS da API de destino
   - Confirme uso consistente de IP

### Debugging

1. **Logs da Aplicação:**
```bash
# Ver logs em tempo real
tail -f logs/app.log

# Para PM2
pm2 logs http-proxy
```

2. **Health Checks:**
```bash
curl https://sua-url-do-servico/health
```

3. **Monitoramento de Sistema:**
```bash
# Verificar uso de recursos
htop
# ou
top

# Verificar conexões de rede
netstat -an | grep :3000
```

## Otimização de Custos

1. **Dimensionamento Adequado:**
   - Monitore uso real de recursos
   - Ajuste configurações de acordo
   - Use instâncias econômicas onde apropriado

2. **Auto Scaling:**
   - Scale baseado na demanda
   - Configure políticas de scaling apropriadas
   - Monitore eventos de scaling

3. **Custos de Rede:**
   - Minimize tráfego desnecessário
   - Otimize transferência de dados
   - Use cache quando possível

## Conclusão

Este serviço de proxy Express.js fornece uma solução robusta para corrigir endereços IP ao fazer requisições HTTP. A abordagem containerizada garante escalabilidade, confiabilidade e comportamento de rede consistente, mantendo as melhores práticas de segurança e performance.

A implementação inclui tratamento abrangente de erros, capacidades de monitoramento e configurações de implantação prontas para produção para garantir operação confiável em ambientes de servidor.
