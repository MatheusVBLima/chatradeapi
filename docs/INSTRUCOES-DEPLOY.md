# 🚀 INSTRUÇÕES DE DEPLOY - RESUMO EXECUTIVO

## ✅ O QUE JÁ FOI FEITO

1. ✅ **Dockerfile corrigido** - Agora instala todas as dependências necessárias para o build
2. ✅ **Scripts criados** - Scripts de instalação e deploy prontos
3. ✅ **Guias documentados** - DEPLOY-GUIDE.md e QUICK-START.md criados

## ⚠️ O QUE VOCÊ PRECISA FAZER

### 📝 ANTES DE COMEÇAR (OBRIGATÓRIO)

#### 1. Configure o DNS do Domínio

No painel do seu provedor de domínio, crie:

- **Registro A**: `@` → `216.238.123.241`
- **Registro A**: `www` → `216.238.123.241`

Aguarde propagação (pode levar até 24h, mas geralmente 1-2 horas).

#### 2. Atualize Configurações com Seu Domínio

**Arquivo: `nginx/sites-available/chatbot-api`**

- Linha 4: Substitua `seu-dominio.com www.seu-dominio.com`
- Linha 20: Substitua `seu-dominio.com www.seu-dominio.com`
- Linhas 23-24: Substitua `seu-dominio.com`

**Arquivo: `docker-compose.yml`**

- Linha 56: Substitua `seu-email@dominio.com` e `seu-dominio.com`

**Arquivo: `scripts/deploy-production.sh`**

- Linha 13: `DOMAIN="seu-dominio-real.com"`
- Linha 14: `EMAIL="seu-email@real.com"`

### 🚀 DEPLOY EM 5 PASSOS

#### Passo 1: Transferir Arquivo de Instalação

```powershell
# No seu PC (PowerShell)
cd "D:\Web Workspace\Freela\adasi\chatbot-api"
scp scripts/install-server-dependencies.sh root@216.238.123.241:/root/
```

#### Passo 2: Instalar Dependências no Servidor

```bash
# Conectar no servidor
ssh root@216.238.123.241

# Executar instalação
cd /root
chmod +x install-server-dependencies.sh
bash install-server-dependencies.sh
```

#### Passo 3: Transferir Projeto

```powershell
# No seu PC (PowerShell)
cd "D:\Web Workspace\Freela\adasi\chatbot-api"
scp -r * root@216.238.123.241:/root/chatbot-api/
scp .env.production .dockerignore root@216.238.123.241:/root/chatbot-api/
```

#### Passo 4: Fazer Deploy

```bash
# No servidor
cd /root/chatbot-api
chmod +x scripts/deploy-production.sh
bash scripts/deploy-production.sh
```

#### Passo 5: Configurar Webhook do Z-API

1. Acesse o painel do Z-API
2. Configure webhook: `https://seu-dominio.com/webhook`
3. Selecione os eventos desejados
4. Salve

## 🔍 VERIFICAÇÃO

```bash
# No servidor, verificar se tudo está rodando
docker-compose ps

# Ver logs
docker-compose logs -f api

# Testar API
curl https://seu-dominio.com/health
```

## 📊 STATUS DOS TODOS

- [ ] **1. DNS Configurado** - Você precisa fazer
- [ ] **2. Arquivos Atualizados** - Você precisa fazer (domínio/email)
- [ ] **3. Arquivos Transferidos** - Passo 1 e 3
- [ ] **4. Deploy Executado** - Passo 2 e 4
- [ ] **5. Webhook Z-API** - Passo 5

## 🆘 PROBLEMAS COMUNS

### Erro: "Could not find TypeScript configuration file"

✅ **RESOLVIDO** - Dockerfile foi corrigido. Se ainda ocorrer, verifique se todos os arquivos foram transferidos.

### Erro: "Failed to obtain certificate"

- Verifique se DNS está configurado: `ping seu-dominio.com`
- Aguarde propagação do DNS
- Verifique se porta 80 está aberta

### API não responde

```bash
docker-compose logs api
docker-compose ps
```

## 📚 DOCUMENTAÇÃO COMPLETA

- **QUICK-START.md** - Comandos rápidos
- **DEPLOY-GUIDE.md** - Guia detalhado passo a passo
- **scripts/deploy-production.sh** - Script automatizado de deploy
- **scripts/install-server-dependencies.sh** - Script de instalação

## 🎯 RESUMO

1. Configure DNS ✅
2. Atualize configurações com seu domínio ✅
3. Execute os 5 passos acima ✅
4. Pronto! Sua API estará rodando com HTTPS ✅

---

**🔥 IMPORTANTE:** O Z-API **EXIGE HTTPS**. Sem certificado SSL configurado, os webhooks não vão funcionar!
