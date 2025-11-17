# 🔧 Solução Completa: Gemini API Vazia no Servidor RADE (Docker)

## 📋 Resumo do Problema
- **API X** funciona no Render (servidor Z) ✅
- **API X** não gera respostas do Gemini no servidor RADE (W) ❌
- Gemini conecta (360ms), chama tools, mas retorna string vazia
- Ambiente: Docker com Nginx como proxy reverso

---

## 🚀 SOLUÇÕES IMEDIATAS

### 1️⃣ Atualizar Configuração do Nginx

#### Arquivo: `nginx/default.conf`
```nginx
# HTTP server - CONFIGURAÇÃO COMPLETA OTIMIZADA
server {
    listen 80;
    server_name _;
    
    # API proxy configuration
    location / {
        # Rate limiting (manter como está)
        limit_req zone=api burst=20 nodelay;
        
        # Proxy settings
        proxy_pass http://chatbot-api:3001;
        
        # ⚠️ CRÍTICO: Configurações para Gemini
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "";  # Mudança importante!
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # ⚠️ TIMEOUTS AUMENTADOS PARA GEMINI
        proxy_connect_timeout 30s;      # Era 5s - CRÍTICO!
        proxy_send_timeout 120s;        # Era 60s
        proxy_read_timeout 120s;         # Era 60s
        proxy_next_upstream_timeout 120s;  # Novo
        
        # ⚠️ BUFFER - ESCOLHA UMA OPÇÃO:
        
        # OPÇÃO A: Desabilitar buffer (recomendado para streaming)
        proxy_buffering off;
        proxy_request_buffering off;
        
        # OPÇÃO B: Aumentar buffers (se preferir manter)
        # proxy_buffering on;
        # proxy_buffer_size 256k;        # Era 128k
        # proxy_buffers 8 256k;          # Era 4 256k
        # proxy_busy_buffers_size 512k;  # Era 256k
        # proxy_temp_file_write_size 512k;
        
        # Keep-alive
        keepalive_timeout 120s;
        keepalive_requests 100;
    }

    # Health check endpoint (manter como está)
    location /health {
        proxy_pass http://chatbot-api:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        access_log off;
    }
}
```

### 2️⃣ Atualizar Docker Compose

#### Arquivo: `docker-compose.yml`
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: chatbot-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    networks:
      - app-network
    depends_on:
      - chatbot-api
    restart: unless-stopped
    # Configurações adicionais
    environment:
      - NGINX_UPSTREAM_TIMEOUT=120s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  chatbot-api:
    build: .
    container_name: chatbot-api
    ports:
      - "3001:3001"  # Expor porta para testes diretos
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=2048
      - HTTP_TIMEOUT=120000
      - GEMINI_TIMEOUT=90000  # Adicionar timeout específico
    env_file:
      - .env
    networks:
      - app-network
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

networks:
  app-network:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1450  # MTU reduzido para evitar problemas
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 3️⃣ Criar Service do Gemini com Retry

#### Arquivo: `src/services/gemini-enhanced.service.ts`
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiEnhancedService {
  private readonly logger = new Logger(GeminiEnhancedService.name);
  private model: GenerativeModel;
  private readonly MAX_RETRIES = 3;
  private readonly BASE_TIMEOUT = 30000; // 30 segundos

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    this.model = genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });
  }

  async generateContentWithRetry(prompt: string): Promise<string> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`[Gemini] Tentativa ${attempt}/${this.MAX_RETRIES}`);
        this.logger.debug(`[Gemini] Prompt: ${prompt.substring(0, 100)}...`);
        
        const startTime = Date.now();
        
        // Fazer a chamada com timeout específico
        const result = await this.callGeminiWithTimeout(prompt, attempt);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        this.logger.log(`[Gemini] Tempo de resposta: ${duration}ms`);
        
        // Extrair e validar resposta
        const text = this.extractAndValidateResponse(result);
        
        if (!text || text.trim() === '') {
          throw new Error('Resposta vazia do Gemini');
        }
        
        this.logger.log(`[Gemini] Sucesso! Tamanho da resposta: ${text.length} caracteres`);
        return text;
        
      } catch (error) {
        lastError = error;
        this.logger.error(`[Gemini] Erro na tentativa ${attempt}: ${error.message}`);
        
        if (attempt < this.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          this.logger.log(`[Gemini] Aguardando ${delay}ms antes da próxima tentativa...`);
          await this.sleep(delay);
        }
      }
    }
    
    this.logger.error(`[Gemini] Falha após ${this.MAX_RETRIES} tentativas`);
    throw new Error(`Gemini falhou após ${this.MAX_RETRIES} tentativas: ${lastError?.message}`);
  }

  private async callGeminiWithTimeout(prompt: string, attempt: number): Promise<any> {
    const timeout = this.BASE_TIMEOUT * attempt; // 30s, 60s, 90s
    
    return Promise.race([
      this.model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout após ${timeout}ms`)), timeout)
      )
    ]);
  }

  private extractAndValidateResponse(result: any): string {
    // Log detalhado da estrutura da resposta
    this.logger.debug('Result type:', typeof result);
    this.logger.debug('Result keys:', Object.keys(result || {}));
    
    if (!result) {
      throw new Error('Resultado nulo do Gemini');
    }
    
    if (!result.response) {
      this.logger.error('Estrutura inesperada:', JSON.stringify(result));
      throw new Error('Resposta sem campo response');
    }
    
    const text = result.response.text();
    
    this.logger.debug(`Text exists: ${!!text}`);
    this.logger.debug(`Text length: ${text?.length || 0}`);
    
    if (text && text.length > 0) {
      this.logger.debug(`Primeiros 100 chars: ${text.substring(0, 100)}`);
    }
    
    return text;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Método de teste direto
  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('[Gemini] Testando conexão...');
      const result = await this.generateContentWithRetry('Responda apenas: TESTE OK');
      return result.includes('OK') || result.includes('TESTE');
    } catch (error) {
      this.logger.error('[Gemini] Teste de conexão falhou:', error);
      return false;
    }
  }
}
```

---

## 🧪 SCRIPTS DE TESTE

### Script 1: Teste Isolado no Servidor
#### Arquivo: `scripts/test-gemini-direct.js`
```javascript
// Teste direto do Gemini sem Docker/Nginx
const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https');
const dns = require('dns').promises;

async function testGeminiDirect() {
  console.log('='.repeat(50));
  console.log('TESTE DIRETO GEMINI - SERVIDOR RADE');
  console.log('='.repeat(50));
  
  // Informações do ambiente
  console.log('\n📍 AMBIENTE:');
  console.log('- Hostname:', require('os').hostname());
  console.log('- Node version:', process.version);
  console.log('- Timestamp:', new Date().toISOString());
  console.log('- API Key exists:', !!process.env.GEMINI_API_KEY);
  
  // Teste 1: DNS
  console.log('\n🔍 TESTE DNS:');
  try {
    const addresses = await dns.resolve4('generativelanguage.googleapis.com');
    console.log('✅ DNS resolvido:', addresses);
  } catch (error) {
    console.error('❌ Erro DNS:', error.message);
  }
  
  // Teste 2: HTTPS
  console.log('\n🌐 TESTE HTTPS:');
  await new Promise((resolve) => {
    https.get('https://generativelanguage.googleapis.com', (res) => {
      console.log('✅ HTTPS Status:', res.statusCode);
      resolve();
    }).on('error', (err) => {
      console.error('❌ Erro HTTPS:', err.message);
      resolve();
    });
  });
  
  // Teste 3: Gemini API
  console.log('\n🤖 TESTE GEMINI API:');
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não encontrada!');
    return;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    console.log('Enviando requisição...');
    const startTime = Date.now();
    
    const result = await model.generateContent('Responda apenas: SERVIDOR RADE OK');
    const text = result.response.text();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Tempo de resposta: ${duration}ms`);
    console.log(`✅ Resposta: "${text}"`);
    console.log(`✅ Tamanho: ${text?.length || 0} caracteres`);
    
    if (!text || text.trim() === '') {
      console.error('⚠️ ATENÇÃO: Resposta vazia!');
      console.log('Debug - Result completo:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erro Gemini:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n' + '='.repeat(50));
}

// Executar teste
testGeminiDirect().then(() => {
  console.log('Teste concluído!');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
```

### Script 2: Teste Dentro do Docker
#### Arquivo: `scripts/test-gemini-docker.js`
```javascript
// Teste dentro do container Docker
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');

async function testInsideDocker() {
  console.log('='.repeat(50));
  console.log('TESTE DENTRO DO CONTAINER DOCKER');
  console.log('='.repeat(50));
  
  console.log('\n📍 CONTAINER INFO:');
  console.log('- Container ID:', process.env.HOSTNAME);
  console.log('- Node version:', process.version);
  console.log('- Timestamp:', new Date().toISOString());
  
  // Teste 1: Conectividade externa
  console.log('\n🌐 TESTE CONECTIVIDADE:');
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: '/',
    method: 'HEAD'
  };
  
  await new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log('✅ Google API acessível - Status:', res.statusCode);
      resolve();
    });
    
    req.on('error', (e) => {
      console.error('❌ Erro de rede:', e.message);
      resolve();
    });
    
    req.end();
  });
  
  // Teste 2: Gemini API
  console.log('\n🤖 TESTE GEMINI NO DOCKER:');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não encontrada no container!');
    return;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    console.log('Chamando Gemini do container...');
    const startTime = Date.now();
    
    const result = await model.generateContent('Diga: DOCKER FUNCIONANDO');
    const text = result.response.text();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Tempo: ${duration}ms`);
    console.log(`✅ Resposta do Gemini: "${text}"`);
    
    if (!text) {
      console.error('⚠️ PROBLEMA: Resposta vazia dentro do Docker!');
    }
    
  } catch (error) {
    console.error('❌ Erro no container:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
}

testInsideDocker().then(() => {
  console.log('Teste do Docker concluído!');
}).catch(err => {
  console.error('Erro fatal no Docker:', err);
});
```

### Script 3: Teste Completo de Diagnóstico
#### Arquivo: `scripts/diagnose-all.sh`
```bash
#!/bin/bash

echo "=========================================="
echo "DIAGNÓSTICO COMPLETO - SERVIDOR RADE"
echo "=========================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar containers rodando
echo -e "\n${YELLOW}1. CONTAINERS DOCKER:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Testar API diretamente (sem Nginx)
echo -e "\n${YELLOW}2. TESTE DIRETO NA API (porta 3001):${NC}"
curl -s -X POST http://localhost:3001/health | jq '.' || echo "❌ API não responde diretamente"

# 3. Testar através do Nginx
echo -e "\n${YELLOW}3. TESTE ATRAVÉS DO NGINX (porta 80):${NC}"
curl -s -X POST http://localhost:80/health | jq '.' || echo "❌ Nginx não está redirecionando"

# 4. Testar Gemini direto no host
echo -e "\n${YELLOW}4. TESTE GEMINI NO HOST:${NC}"
if [ -f ".env" ]; then
    export $(cat .env | grep GEMINI_API_KEY | xargs)
    node scripts/test-gemini-direct.js
else
    echo "❌ Arquivo .env não encontrado"
fi

# 5. Testar Gemini dentro do Docker
echo -e "\n${YELLOW}5. TESTE GEMINI DENTRO DO DOCKER:${NC}"
API_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "api|chatbot" | head -1)
if [ ! -z "$API_CONTAINER" ]; then
    docker exec $API_CONTAINER node scripts/test-gemini-docker.js
else
    echo "❌ Container da API não encontrado"
fi

# 6. Verificar logs recentes
echo -e "\n${YELLOW}6. ÚLTIMOS LOGS DE ERRO:${NC}"
echo "Nginx errors:"
docker logs nginx 2>&1 | tail -5 | grep -i error || echo "Sem erros recentes"

echo -e "\nAPI errors:"
docker logs $API_CONTAINER 2>&1 | tail -5 | grep -i error || echo "Sem erros recentes"

# 7. Verificar MTU da rede Docker
echo -e "\n${YELLOW}7. MTU DA REDE DOCKER:${NC}"
docker network inspect bridge | grep -i mtu || echo "1500 (padrão)"

# 8. Testar latência para Google
echo -e "\n${YELLOW}8. LATÊNCIA PARA GOOGLE APIS:${NC}"
ping -c 3 generativelanguage.googleapis.com | grep "avg"

echo -e "\n${GREEN}=========================================="
echo "DIAGNÓSTICO CONCLUÍDO!"
echo "==========================================${NC}"
```

---

## 🎯 COMANDOS RÁPIDOS PARA EXECUTAR

```bash
# 1. Tornar script executável
chmod +x scripts/diagnose-all.sh

# 2. Executar diagnóstico completo
./scripts/diagnose-all.sh

# 3. Testar direto (sem Docker)
node scripts/test-gemini-direct.js

# 4. Testar dentro do container
docker exec chatbot-api node scripts/test-gemini-docker.js

# 5. Testar API sem Nginx
curl -X POST http://localhost:3001/chat/test_open \
  -H "Content-Type: application/json" \
  -d '{"message":"teste direto"}'

# 6. Testar API com Nginx
curl -X POST http://localhost/chat/test_open \
  -H "Content-Type: application/json" \
  -d '{"message":"teste via nginx"}'

# 7. Ver logs em tempo real
docker logs -f chatbot-api 2>&1 | grep -i gemini

# 8. Reiniciar containers com nova config
docker-compose down && docker-compose up -d

# 9. Rebuild com cache limpo
docker-compose build --no-cache && docker-compose up -d
```

---

## ✅ CHECKLIST DE RESOLUÇÃO

1. [ ] Atualizar `nginx/default.conf` com timeouts aumentados
2. [ ] Atualizar `docker-compose.yml` com MTU reduzido
3. [ ] Criar o service `gemini-enhanced.service.ts` com retry
4. [ ] Executar script de diagnóstico direto no host
5. [ ] Executar script de teste dentro do Docker
6. [ ] Verificar se funciona sem Nginx (porta 3001)
7. [ ] Verificar se funciona com Nginx (porta 80)
8. [ ] Analisar logs para identificar onde falha
9. [ ] Aplicar a solução específica baseada nos testes
10. [ ] Reiniciar containers e testar novamente

---

## 🚨 SOLUÇÕES POR SINTOMA

### Se funciona DIRETO mas não via NGINX:
- Aplicar configurações do Nginx (timeouts e buffer)
- Verificar logs do Nginx: `docker logs nginx`

### Se NÃO funciona nem DIRETO no Docker:
- Problema de rede Docker ou MTU
- Aplicar MTU 1450 no docker-compose
- Verificar DNS dentro do container

### Se resposta sempre VAZIA mas conecta:
- Implementar o retry com timeout maior
- Verificar estrutura da resposta do Gemini
- Adicionar logs detalhados no service

### Se timeout constante:
- Aumentar todos os timeouts (Nginx + Node)
- Verificar latência real: `ping generativelanguage.googleapis.com`
- Considerar usar proxy ou cache

---

## 📞 SUPORTE

Se após todos os testes o problema persistir, colete:

1. Output do script `diagnose-all.sh`
2. Logs completos: `docker logs chatbot-api > api.log`
3. Configuração do servidor: `uname -a && docker version`
4. Teste de rede: `traceroute generativelanguage.googleapis.com`

---

**Última atualização:** 2024
**Versão:** 1.0.0
**Status:** Pronto para implementação


💡 Minha Análise do Problema
Com base nos sintomas que você descreveu, acredito que o problema seja:
Timeout do Nginx cortando a resposta do Gemini
Por quê?

Timeout de 5 segundos é muito curto - Seu Nginx está configurado com proxy_connect_timeout 5s, mas com latência Brasil-EUA (360ms) + processamento do Gemini, a resposta pode demorar 6-10 segundos para voltar
Buffer do Nginx descartando resposta "incompleta" - Como o Gemini envia respostas em streaming, o Nginx com proxy_buffering on pode estar esperando o fim da transmissão e descartando quando atinge o timeout
Funciona no Render mas não no RADE - O Render provavelmente tem configurações de proxy mais permissivas ou não usa Nginx como proxy reverso

Evidências:

✅ Gemini conecta (você vê 360ms)
✅ Tools são chamadas (processamento local)
❌ String vem vazia (resposta cortada no retorno)
✅ Funciona em outro servidor (configuração diferente)

Solução mais provável:
