# Configuração de Domínio e Email

## ⚙️ ATUALIZE ESTAS INFORMAÇÕES

Antes de fazer o deploy, substitua os valores abaixo nos arquivos indicados:

```
SEU_DOMINIO=exemplo.com
SEU_EMAIL=admin@exemplo.com
```

---

## 📝 ARQUIVOS QUE PRECISAM SER ATUALIZADOS

### 1. nginx/sites-available/chatbot-api

**Linha 4:**

```nginx
# ANTES:
server_name seu-dominio.com www.seu-dominio.com;

# DEPOIS (exemplo):
server_name meusite.com.br www.meusite.com.br;
```

**Linha 20:**

```nginx
# ANTES:
server_name seu-dominio.com www.seu-dominio.com;

# DEPOIS (exemplo):
server_name meusite.com.br www.meusite.com.br;
```

**Linhas 23-24:**

```nginx
# ANTES:
ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

# DEPOIS (exemplo):
ssl_certificate /etc/letsencrypt/live/meusite.com.br/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/meusite.com.br/privkey.pem;
```

---

### 2. docker-compose.yml

**Linha 56:**

```yaml
# ANTES:
command: certonly --webroot --webroot-path=/var/www/certbot --email seu-email@dominio.com --agree-tos --no-eff-email -d seu-dominio.com

# DEPOIS (exemplo):
command: certonly --webroot --webroot-path=/var/www/certbot --email admin@meusite.com.br --agree-tos --no-eff-email -d meusite.com.br -d www.meusite.com.br
```

**⚠️ IMPORTANTE:** Adicione `-d www.seu-dominio.com` no final para incluir o subdomínio www

---

### 3. scripts/deploy-production.sh

**Linhas 13-14:**

```bash
# ANTES:
DOMAIN="seu-dominio.com"
EMAIL="seu-email@dominio.com"

# DEPOIS (exemplo):
DOMAIN="meusite.com.br"
EMAIL="admin@meusite.com.br"
```

---

## ✅ CHECKLIST DE ATUALIZAÇÃO

Antes de fazer deploy, confirme:

- [ ] Atualizei `nginx/sites-available/chatbot-api` (3 locais)
- [ ] Atualizei `docker-compose.yml` (linha 56)
- [ ] Atualizei `scripts/deploy-production.sh` (linhas 13-14)
- [ ] Configurei DNS do domínio apontando para `216.238.123.241`
- [ ] Testei DNS com `ping meu-dominio.com`

---

## 🎯 ATALHO: Script de Busca e Substituição

Você pode usar Find & Replace no VS Code:

1. Pressione `Ctrl + Shift + H` (Find and Replace em múltiplos arquivos)
2. Substitua:
   - `seu-dominio.com` → `meusite.com.br` (seu domínio real)
   - `seu-email@dominio.com` → `admin@meusite.com.br` (seu email real)
3. Verifique manualmente os resultados antes de salvar

---

## 📋 EXEMPLO COMPLETO

Se seu domínio for `chatbot-rade.com.br` e email `admin@chatbot-rade.com.br`:

**nginx/sites-available/chatbot-api:**

```nginx
server_name chatbot-rade.com.br www.chatbot-rade.com.br;
```

**docker-compose.yml:**

```yaml
command: certonly --webroot --webroot-path=/var/www/certbot --email admin@chatbot-rade.com.br --agree-tos --no-eff-email -d chatbot-rade.com.br -d www.chatbot-rade.com.br
```

**scripts/deploy-production.sh:**

```bash
DOMAIN="chatbot-rade.com.br"
EMAIL="admin@chatbot-rade.com.br"
```
