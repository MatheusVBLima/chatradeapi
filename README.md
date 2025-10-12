# Chat RADE API

API de chatbot para a plataforma RADE desenvolvida com NestJS.

## 🚀 Deploy em Produção

### 📖 Documentação Completa de Deploy

Para fazer o deploy em produção (servidor VPS com Docker + Nginx + HTTPS):

1. **🔥 [INSTRUCOES-DEPLOY.md](./INSTRUCOES-DEPLOY.md)** - Resumo executivo (comece aqui!)
2. **⚡ [QUICK-START.md](./QUICK-START.md)** - Comandos rápidos para copiar/colar
3. **📖 [DEPLOY-GUIDE.md](./DEPLOY-GUIDE.md)** - Guia completo passo a passo
4. **⚙️ [CONFIGURACAO-DOMINIO.md](./CONFIGURACAO-DOMINIO.md)** - Como configurar domínio
5. **📊 [README-DEPLOY.txt](./README-DEPLOY.txt)** - Diagrama visual do processo

### ⚡ Deploy Rápido

```bash
# 1. Configure DNS do domínio para apontar para o IP do servidor
# 2. Atualize arquivos com seu domínio (ver CONFIGURACAO-DOMINIO.md)
# 3. Transfira arquivos e execute deploy (ver QUICK-START.md)
```

---

## 💻 Desenvolvimento Local

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação e execução

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run start:dev

# Executar em produção local
npm run build
npm run start:prod
```

### Configuração

1. Copie o arquivo `.env.example` para `.env.development`
2. Configure as variáveis de ambiente necessárias
3. Execute o projeto

## 📚 Endpoints

- `POST /chat/open` - Chat aberto com IA
- `POST /chat/closed` - Chat guiado por fluxo
- `POST /chat/hybrid` - Chat híbrido
- `GET /health` - Status da API

## 🏗️ Arquitetura

Projeto seguindo Clean Architecture com NestJS:

- **Domain**: Entidades e regras de negócio
- **Application**: Casos de uso
- **Infrastructure**: Controllers, services e integrações

## 🔧 Scripts disponíveis

```bash
npm run start:dev    # Desenvolvimento com hot reload
npm run build        # Build de produção
npm run test         # Executar testes
npm run format       # Formatar código
```
