# 🔧 Instruções para Aplicar o Fix do Gemini no Servidor Vultr

## 📋 Resumo das Correções Implementadas

Foram feitas correções críticas para resolver o problema do Gemini não gerar texto no servidor Vultr:

### ✅ Arquivos Modificados
1. **[nginx/default.conf](../nginx/default.conf)** - Timeouts e buffering corrigidos
2. **[docker-compose.yml](../docker-compose.yml)** - Configurações de rede e MTU otimizadas

### ✅ Novos Scripts Criados
1. **[scripts/test-gemini-direct.js](../scripts/test-gemini-direct.js)** - Teste direto no host
2. **[scripts/test-gemini-docker.js](../scripts/test-gemini-docker.js)** - Teste dentro do container
3. **[scripts/diagnose-all.sh](../scripts/diagnose-all.sh)** - Diagnóstico completo

---

## 🚀 Passo a Passo para Aplicar no Servidor Vultr

### 1. Fazer Backup da Configuração Atual

```bash
# No servidor Vultr, dentro da pasta do projeto
cd /root/chatbotrade  # ou o caminho correto

# Backup dos arquivos que serão modificados
cp nginx/default.conf nginx/default.conf.backup
cp docker-compose.yml docker-compose.yml.backup

# Verificar git status
git status
```

### 2. Atualizar o Código do Repositório

```bash
# Fazer pull das mudanças do repositório
git pull origin main

# Ou se você transferiu os arquivos manualmente, verificar se estão corretos
git diff nginx/default.conf
git diff docker-compose.yml
```

### 3. Tornar o Script de Diagnóstico Executável

```bash
chmod +x scripts/diagnose-all.sh
```

### 4. Executar Diagnóstico ANTES do Deploy

```bash
# Rodar diagnóstico completo para ter baseline
./scripts/diagnose-all.sh > diagnostico-antes.log 2>&1

# Ver o resultado
cat diagnostico-antes.log
```

### 5. Reconstruir e Reiniciar os Containers

```bash
# Parar containers atuais
docker-compose down

# Reconstruir com nova configuração (IMPORTANTE: rebuild para garantir que mudanças sejam aplicadas)
docker-compose build --no-cache

# Subir novamente
docker-compose up -d

# Verificar se containers subiram corretamente
docker ps
```

### 6. Verificar Logs em Tempo Real

```bash
# Em um terminal, acompanhar logs da API
docker logs -f chatbot-api

# Em outro terminal, testar a API
```

### 7. Executar Diagnóstico DEPOIS do Deploy

```bash
# Aguardar ~30 segundos para containers estabilizarem
sleep 30

# Rodar diagnóstico novamente
./scripts/diagnose-all.sh > diagnostico-depois.log 2>&1

# Ver o resultado
cat diagnostico-depois.log
```

### 8. Testar Gemini Diretamente

```bash
# Teste 1: Gemini direto no host (sem Docker)
node scripts/test-gemini-direct.js

# Teste 2: Gemini dentro do container
docker exec chatbot-api node scripts/test-gemini-docker.js

# Teste 3: API endpoint real (sem Nginx)
curl -X POST http://localhost:3001/chat/test_open \
  -H "Content-Type: application/json" \
  -d '{"message":"quais os meus dados?","phone":"5581999999999","cpf":"07448080490"}'

# Teste 4: API endpoint através do Nginx
curl -X POST http://localhost/chat/test_open \
  -H "Content-Type: application/json" \
  -d '{"message":"quais os meus dados?","phone":"5581999999999","cpf":"07448080490"}'
```

---

## 🔍 O Que Verificar nos Logs

### ✅ Sinais de Sucesso

Procure por estas mensagens nos logs:

```
[AI-SDK5] Complete text: "Seus dados:..."  ← ✅ TEXTO FOI GERADO!
[AI-SDK5] onStepFinish: { textLength: 564, outputTokens: 152 }  ← ✅ outputTokens DEFINIDO!
```

### ❌ Sinais de Problema

Se você ainda ver:

```
[AI-SDK5] Complete text: ""  ← ❌ AINDA VAZIO
[AI-SDK5] onStepFinish: { textLength: 0, outputTokens: undefined }  ← ❌ AINDA QUEBRADO
[AI-SDK5] Empty response! Using emergency fallback...  ← ❌ AINDA USANDO FALLBACK
```

---

## 🎯 Principais Mudanças Aplicadas

### 1. Nginx - Timeouts Aumentados

```nginx
# ANTES (causava timeout)
proxy_connect_timeout 5s;    # Muito curto!
proxy_send_timeout 60s;
proxy_read_timeout 60s;

# DEPOIS (suficiente para Gemini)
proxy_connect_timeout 30s;   # 6x maior
proxy_send_timeout 120s;     # 2x maior
proxy_read_timeout 120s;     # 2x maior
proxy_next_upstream_timeout 120s;  # Novo
```

### 2. Nginx - Buffering Desabilitado

```nginx
# ANTES (buffer podia descartar resposta)
proxy_buffering on;
proxy_buffer_size 128k;
proxy_buffers 4 256k;

# DEPOIS (streaming direto)
proxy_buffering off;
proxy_request_buffering off;
```

### 3. Docker - MTU e Timeouts

```yaml
# ANTES
networks:
  chatbot-network:
    driver: bridge

# DEPOIS (MTU reduzido evita fragmentação)
networks:
  chatbot-network:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1450
```

---

## 🐛 Troubleshooting

### Problema: Containers não sobem após mudanças

```bash
# Ver logs de erro
docker-compose logs

# Verificar sintaxe do docker-compose
docker-compose config

# Tentar remover tudo e recriar
docker-compose down -v
docker-compose up -d
```

### Problema: Nginx não carrega nova configuração

```bash
# Testar configuração do Nginx
docker exec chatbot-nginx nginx -t

# Recarregar config sem reiniciar
docker exec chatbot-nginx nginx -s reload

# Ou reiniciar container específico
docker-compose restart nginx
```

### Problema: API ainda retorna resposta vazia

Se após todas as correções o problema persistir:

1. **Verificar se realmente está usando gemini-2.0-flash**:
   ```bash
   docker exec chatbot-api grep -n "gemini-2.0-flash" /app/dist/infrastructure/services/gemini-ai.service.js
   ```

2. **Coletar logs detalhados**:
   ```bash
   docker logs chatbot-api 2>&1 | grep -A 10 -B 10 "outputTokens"
   ```

3. **Considerar implementar Fix 1A** (retry quando vazio):
   - Ver arquivo [BUG-GEMINI-VULTR.md](./BUG-GEMINI-VULTR.md) seção "Fix 1A"

---

## 📊 Métricas para Monitorar

Após aplicar o fix, monitorar:

1. **Taxa de respostas vazias**: Deve ser ~0%
2. **Latência média**: Deve ficar entre 2-5 segundos
3. **Taxa de erro 504 (timeout)**: Deve ser 0%
4. **Uso de fallback**: Deve ser raro (apenas quando Gemini realmente falhar)

---

## 📞 Suporte

Se o problema persistir após seguir todos os passos:

1. Executar: `./scripts/diagnose-all.sh > diagnostico-completo.log 2>&1`
2. Coletar: `docker logs chatbot-api > api-logs.log 2>&1`
3. Coletar: `docker logs chatbot-nginx > nginx-logs.log 2>&1`
4. Enviar os 3 arquivos de log para análise

---

**Última atualização:** 2025-01-13
**Responsável:** Claude (AI Assistant)
**Status:** Pronto para deploy
