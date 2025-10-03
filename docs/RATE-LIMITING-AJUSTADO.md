# Rate Limiting Ajustado - 30 req/min

## 🎯 O que foi feito

Ajustamos o rate limiting para **30 requisições por minuto** com exceções inteligentes para endpoints críticos.

---

## ⚙️ Configuração Atual

### **Limite Global: 30 req/min**

Todos os endpoints de chat/IA têm limite de **30 requisições por minuto** por IP:

```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,  // 1 minuto
  limit: 30,   // 30 requisições máximo
}])
```

**Aplicado em:**
- ✅ `AppModule` (modo misto)
- ✅ `AppApiModule` (modo produção com API real)
- ✅ `AppMockModule` (modo teste com mock)

---

## 🚫 Endpoints SEM Limite (sempre disponíveis)

Os seguintes endpoints **NÃO** têm rate limiting:

### 1. **Health Checks** (`@SkipThrottle()`)
```typescript
GET /health           // Health principal
GET /health/detailed  // Health detalhado
POST /chat/health     // Health do chat
```

**Por quê?**
- ✅ Monitoring (Uptime Robot, etc.) precisa funcionar sempre
- ✅ Load balancers precisam verificar saúde
- ✅ DevOps/alertas precisam funcionar 24/7

### 2. **Webhooks** (`@SkipThrottle()`)
```typescript
POST /webhook/zapi        // Webhook Z-API (WhatsApp)
POST /webhook/zapi-health // Health do webhook
```

**Por quê?**
- ✅ Z-API precisa enviar mensagens do WhatsApp sem bloqueio
- ✅ Conversas do WhatsApp não podem ser perdidas
- ✅ Usuários esperam resposta imediata no WhatsApp

---

## 🔒 Endpoints COM Limite (30 req/min)

Todos os outros endpoints têm rate limiting:

### **Chat/IA (caros, usam Gemini)**
- `POST /chat/open` → 30 req/min
- `POST /chat/closed` → 30 req/min
- `POST /chat/hybrid` → 30 req/min
- `POST /chat/api` → 30 req/min
- `POST /chat/test_open` → 30 req/min
- `POST /chat/test_closed` → 30 req/min
- `POST /chat/test_hybrid` → 30 req/min

### **Outros endpoints**
- `POST /chat-master` → 30 req/min
- `POST /report/*` → 30 req/min
- `POST /metrics/*` → 30 req/min
- `GET /simulation/*` → 30 req/min

---

## 📊 Exemplo de Uso

### **Cenário 1: Usuário Normal**
```
Usuário faz 10 mensagens no chat em 1 minuto
✅ Todas funcionam normalmente (dentro do limite)
```

### **Cenário 2: Usuário Abusando**
```
Bot/script tenta 31 requisições em 1 minuto

Requisição 1-30: ✅ OK
Requisição 31+:  ❌ HTTP 429 Too Many Requests

Resposta:
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

### **Cenário 3: Monitoring/WhatsApp**
```
Health checks fazem 100 requisições/min: ✅ SEMPRE OK
Webhooks recebem 50 msgs/min do WhatsApp: ✅ SEMPRE OK

Nenhum bloqueio!
```

---

## 🎯 Benefícios

### **Para o Sistema:**
- ✅ Protege contra abuso/DDoS
- ✅ Reduz custos com Gemini API (30 msgs/min vs 60 msgs/min)
- ✅ Evita sobrecarga do servidor
- ✅ Garante fair use entre usuários

### **Para Operação:**
- ✅ Health checks SEMPRE funcionam (monitoring nunca falha)
- ✅ WhatsApp SEMPRE funciona (webhooks sem limite)
- ✅ Usuários normais não são afetados (30 msg/min é razoável)

---

## 🔧 Como Funciona na Prática

### **Rate Limiting por IP:**
```
IP 192.168.1.1 faz 30 requisições → OK
IP 192.168.1.2 faz 30 requisições → OK (limite separado!)

Cada IP tem seu próprio contador de 30 req/min
```

### **Contador Reseta a Cada Minuto:**
```
10:00:00 - Req 1-30  → ✅ OK
10:00:59 - Req 31    → ❌ BLOQUEADO
10:01:00 - Contador reseta
10:01:01 - Req 1     → ✅ OK novamente
```

---

## ⚠️ Importante Saber

### **Para Desenvolvimento:**
```bash
# Se estiver testando localmente e bater no limite:
# Opção 1: Aguarde 1 minuto
# Opção 2: Reinicie o servidor (reseta contadores)
# Opção 3: Teste com IPs diferentes
```

### **Para Produção:**
```bash
# Se tiver load balancer/proxy:
# Certifique-se que o IP real do usuário está sendo passado
# Senão todos vão compartilhar o mesmo limite!
```

---

## 📝 Arquivos Modificados

1. ✅ `src/app.module.ts` - Limite 30 req/min
2. ✅ `src/app-api.module.ts` - Limite 30 req/min
3. ✅ `src/app-mock.module.ts` - Limite 30 req/min + Guard
4. ✅ `src/health/health.controller.ts` - @SkipThrottle()
5. ✅ `src/infrastructure/controllers/zapi-webhook.controller.ts` - @SkipThrottle()
6. ✅ `src/infrastructure/controllers/chat.controller.ts` - @SkipThrottle() no /chat/health

---

## ✅ Build Status

**Build:** ✅ Passou
**Testes:** Pendente
**Deployment:** Pronto para produção

---

## 🎉 Resultado Final

**Rate Limiting Inteligente:**
- 🔒 30 req/min para chat/IA (protege custos e servidor)
- 🚫 SEM limite para health checks (monitoring sempre funciona)
- 🚫 SEM limite para webhooks (WhatsApp sempre funciona)

**Perfeito para seu caso de uso! 🚀**
