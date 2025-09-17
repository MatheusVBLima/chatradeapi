# Chat RADE API

API de chatbot para a plataforma RADE desenvolvida com NestJS.

## 🚀 Como rodar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação e execução

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run start:dev

# Executar em produção
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