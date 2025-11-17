# Documentação Completa de Fluxos - Chatbot RADE

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Parâmetro Environment](#parâmetro-environment)
3. [Endpoints de Teste](#endpoints-de-teste)
4. [Endpoints de Produção](#endpoints-de-produção)
5. [Comparação de Ambientes](#comparação-de-ambientes)
6. [Sistema de Notificações](#sistema-de-notificações)

---

## 🎯 Visão Geral

### Tipos de Endpoints

O chatbot RADE possui **6 endpoints principais**:

| Endpoint | Tipo | Uso Primário | Prefixo | API |
|----------|------|--------------|---------|-----|
| `/chat/test_hybrid` | Híbrido | chat-front (web) | `[TESTE]` | Staging |
| `/chat/test_open` | Aberto | chat-front (web) | `[TESTE]` | Staging |
| `/chat/test_closed` | Fechado | chat-front (web) | `[TESTE]` | Staging |
| `/chat/hybrid` | Híbrido | Z-API WhatsApp | - | Produção |
| `/chat/open` | Aberto | Z-API WhatsApp | - | Produção |
| `/chat/closed` | Fechado | Z-API WhatsApp | - | Produção |

> ⚠️ **IMPORTANTE:** Qualquer endpoint pode ser usado em WEB ou MOBILE. O comportamento é determinado pelo **parâmetro `environment`** na requisição, não pelo endpoint em si.

---

## 🔧 Parâmetro Environment

### Como Funciona

Todos os endpoints aceitam o parâmetro `environment` no body da requisição:

```json
{
  "message": "Olá",
  "environment": "WEB" // ou "MOBILE"
}
```

### Comportamento por Environment

| Environment | Solicita Telefone? | Quando? | Origem do Telefone |
|-------------|-------------------|---------|-------------------|
| `WEB` | ✅ Sim | Imediatamente após CPF | Usuário digita |
| `MOBILE` | ❌ Não | - | Z-API detecta automaticamente |

### Exemplos de Uso

#### Exemplo 1: `/chat/open` em site (WEB)
```json
POST /chat/open
{
  "message": "Olá",
  "environment": "WEB"
}
```
**Resultado:** Pede CPF → Pede TELEFONE → Valida ambos → Chat com IA

#### Exemplo 2: `/chat/open` em WhatsApp (MOBILE)
```json
POST /chat/open
{
  "message": "Olá",
  "environment": "MOBILE",
  "phone": "5581999999999" // vem do Z-API automaticamente
}
```
**Resultado:** Pede CPF → Valida CPF (telefone já veio) → Chat com IA

#### Exemplo 3: `/chat/test_hybrid` sempre é WEB
```json
POST /chat/test_hybrid
{
  "message": "Olá"
  // environment é sempre "WEB" (implícito)
}
```
**Resultado:** Sempre pede telefone manualmente (ambiente de teste)

---

## 🧪 ENDPOINTS DE TESTE

> **Características:**
> - Prefixo `[TESTE]` em todas as respostas
> - API RADE Staging
> - Sempre usa `environment: "WEB"` (implícito)
> - **Estados visíveis na documentação** (🔄 Estado: X) mas **não aparecem nas respostas reais do bot**

### `/chat/test_hybrid` - Fluxo Híbrido de Teste

> **Uso:** Interface web (chat-front)
> **Autenticação:** CPF + Telefone manual
> **API:** RADE Staging

#### 🔐 Fluxo de Autenticação Completo

**Passo 1:** Mensagem inicial
```
📤 VOCÊ: Olá

💬 BOT: [TESTE] Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1 - Sou Estudante
2 - Sou Coordenador
3 - Ainda não sou usuário
```

**Passo 2:** Escolha de perfil
```
📤 VOCÊ: 1

💬 BOT: Entendido. Para continuar, por favor, informe seu CPF (apenas números).
```

**Passo 3:** Informar CPF
```
📤 VOCÊ: 98765432100

💬 BOT: Ótimo! Agora, por favor, informe seu número de telefone (com DDD, exemplo: 11999999999):
```

**Passo 4:** Informar telefone + Validação
```
📤 VOCÊ: 11999999999

💬 BOT: [TESTE] Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Conversar com Atendente Virtual
8 - Voltar ao menu inicial
9 - Encerrar atendimento
```

> ✅ **Validação:** Neste momento, o sistema busca os dados do estudante na API RADE Staging usando o CPF informado e mostra o nome real da pessoa.

#### 📚 Menu do Estudante - Opções Detalhadas

**Opção 1: Como fazer meu cadastro**
```
📤 VOCÊ: 1

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/cadastro.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

Sub-opções:
- **1 - Sim, foi suficiente:** Volta ao menu principal
- **2 - Não, preciso de mais ajuda:** Inicia processo de transferência para atendente (pula telefone, já foi coletado)
- **3 - Voltar ao menu anterior:** Volta ao menu principal

**Opção 2: Como agendar minhas atividades**
```
📤 VOCÊ: 2

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/agendamento-atividades.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 3: Como iniciar e finalizar atividade**
```
📤 VOCÊ: 3

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/iniciar-finalizar-atividade.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 4: Como fazer uma avaliação**
```
📤 VOCÊ: 4

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 5: Como justificar atividade perdida**
```
📤 VOCÊ: 5

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/justificar-atividade-perdida.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 6: Como preencher meu TCE**
```
📤 VOCÊ: 6

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/preencher-tce.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 7: Conversar com Atendente Virtual (AI)**
```
📤 VOCÊ: 7

💬 BOT: [TESTE] Autenticado com sucesso! Como posso ajudá-lo?

Digite "voltar" para retornar ao menu principal ou "sair" para encerrar.
```

> ✅ **Importante:** No ambiente de teste, o telefone já foi coletado no início, então vai **direto para o chat com IA**, sem pedir telefone novamente.

Exemplo de conversa com IA:
```
📤 VOCÊ: quais os meus dados?

💬 BOT: [TESTE] Seus dados:
• Nome: Joaquim José da Silva Xavier
• Email: r.olisantos@gmail.com
• Telefone: 11999999999
• Grupo: GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG
• Curso: Administração na Wyden Unifavip

📤 VOCÊ: tenho algum preceptor chamado andrey?

💬 BOT: [TESTE] Não encontrei ninguém com esse nome exato, mas você tem André Luiz Gomes da Silva que é parecido. É essa pessoa?

📋 Dados:
• Email: andre.silva@professores.unifavip.edu.br
• Grupos: GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG

📤 VOCÊ: voltar

💬 BOT: [TESTE] Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
...
```

**Opção 8: Voltar ao menu inicial**
```
📤 VOCÊ: 8

💬 BOT: [TESTE] Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1 - Sou Estudante
2 - Sou Coordenador
3 - Ainda não sou usuário
```

**Opção 9: Encerrar atendimento**
```
📤 VOCÊ: 9

💬 BOT: Ok, estou encerrando nosso atendimento. Se precisar de algo mais, basta me chamar!
```

#### 👨‍🏫 Menu do Coordenador - Opções Detalhadas

**Fluxo de autenticação do Coordenador:**
```
📤 VOCÊ: 2 (escolhe Coordenador no menu inicial)

💬 BOT: Entendido. Para continuar, por favor, informe seu CPF (apenas números).

📤 VOCÊ: 12345678901

💬 BOT: Ótimo! Agora, por favor, informe seu número de telefone (com DDD, exemplo: 11999999999):

📤 VOCÊ: 11999999999

💬 BOT: [TESTE] Olá, Maria Silva Coordenadora! Como posso ajudar hoje?
1 - Como validar atividades
2 - Como realizar avaliação
3 - Como baixar aplicativo para preceptores
4 - Como gerar QR code
5 - Conversar com Atendente Virtual
6 - Voltar ao menu inicial
7 - Encerrar atendimento
```

**Opção 1: Como validar atividades**
```
📤 VOCÊ: 1

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/validar-rejeitar-atividades.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 2: Como realizar avaliação**
```
📤 VOCÊ: 2

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 3: Como baixar aplicativo para preceptores**
```
📤 VOCÊ: 3

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/rade-profissional-funcionalidades.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 4: Como gerar QR code**
```
📤 VOCÊ: 4

💬 BOT: Claro! Aqui está o vídeo sobre isso: https://rade.b-cdn.net/bot/videos/gerar-qr-code.mp4

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior
```

**Opção 5: Conversar com Atendente Virtual**
```
📤 VOCÊ: 5

💬 BOT: [TESTE] Autenticado com sucesso! Como posso ajudá-lo?

Digite "voltar" para retornar ao menu principal ou "sair" para encerrar.
```

**Opção 6: Voltar ao menu inicial**
```
📤 VOCÊ: 6

💬 BOT: [TESTE] Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1 - Sou Estudante
2 - Sou Coordenador
3 - Ainda não sou usuário
```

**Opção 7: Encerrar atendimento**
```
📤 VOCÊ: 7

💬 BOT: Compreendido. Estou encerrando nosso atendimento.
```

#### 🆕 Fluxo de Novo Usuário

**Opção 3 do menu inicial: Ainda não sou usuário**
```
📤 VOCÊ: 3

💬 BOT: Ok. Para realizar seu cadastro inicial, por favor, me diga seu nome completo, CPF, instituição, curso e período, tudo em uma única mensagem.

📤 VOCÊ: João Silva, CPF 12345678901, Wyden Unifavip, Medicina, 3º período

💬 BOT: Obrigado! Seus dados foram recebidos e encaminhados para [Nome da Atendente], responsável pela Wyden Unifavip.

Em breve entraremos em contato para finalizar seu cadastro. O atendimento será encerrado.
```

> ✅ **Processo:** O sistema identifica a instituição (Wyden Unifavip), localiza a atendente responsável e envia uma notificação via WhatsApp com os dados do novo usuário.

#### 🔄 Transferência para Atendimento Humano

Quando o usuário escolhe "2 - Não, preciso de mais ajuda" após visualizar um vídeo:

```
📤 VOCÊ: 2 (após assistir algum vídeo)

💬 BOT: ✅ [TESTE] Transferência realizada com sucesso!

Isabel Suporte Rade irá entrar em contato com você pelo número 5581XXXXXXXXX.

O atendimento será encerrado agora. Aguarde o contato!
```

> ✅ **Importante:** No ambiente de teste (WEB), o telefone já foi coletado no início do fluxo, então **não pede telefone novamente** para transferência.

---

### `/chat/test_open` - Chat Aberto de Teste

> **Uso:** Interface web (chat-front)
> **Autenticação:** CPF + Telefone manual
> **API:** RADE Staging
> **Funcionalidade:** Chat direto com IA, sem menus

#### Fluxo Completo

**Passo 1:** Primeira mensagem
```
📤 VOCÊ: Olá

💬 BOT: Bem-vindo ao Chat com IA RADE!

Para começar, por favor informe seu CPF (apenas números):
```

**Passo 2:** Informar CPF (valida formato apenas)
```
📤 VOCÊ: 98765432100

💬 BOT: Ótimo! Agora, por favor informe seu número de telefone com DDD (exemplo: 11999999999):
```

**Passo 3:** Informar telefone + Validação
```
📤 VOCÊ: 11999999999

💬 BOT: Olá, Joaquim José da Silva Xavier! Você está autenticado.

Pode fazer suas perguntas sobre o sistema RADE!
```

> ✅ **Validação:** Neste momento, o sistema busca os dados do estudante/coordenador na API RADE Staging usando CPF + telefone e mostra o nome real.

**Passo 4:** Conversa livre com IA
```
📤 VOCÊ: quais são as minhas atividades agendadas?

💬 BOT: [TESTE] Você tem 2 atividades agendadas:

1. Plantão Médico
   • Local: Hospital Universitário
   • Data: 15/10/2025
   • Horário: 08:00 - 12:00
   • Preceptores: Dr. João Silva, Dra. Maria Santos

2. Ambulatório
   • Local: Clínica Médica
   • Data: 18/10/2025
   • Horário: 14:00 - 18:00
   • Preceptores: Dr. Pedro Costa
```

---

### `/chat/test_closed` - Chat Fechado de Teste

> **Uso:** Interface web (chat-front)
> **Autenticação:** CPF + Telefone manual
> **API:** RADE Staging
> **Funcionalidade:** Menu estruturado sem IA

#### Fluxo Completo

**Igual ao `/chat/test_hybrid`**, mas **SEM a opção 7 (Conversar com Atendente Virtual)**.

Menu do Estudante:
```
[TESTE] Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Voltar ao menu inicial
8 - Encerrar atendimento
```

> ❌ **Diferença:** Não possui chat com IA. Apenas menu estruturado com vídeos e transferência para atendente.

---

## 🚀 ENDPOINTS DE PRODUÇÃO

> **Características:**
> - **SEM** prefixo `[TESTE]` nas respostas
> - API RADE Produção
> - Suporta `environment: "WEB"` ou `environment: "MOBILE"`
> - **Estados NÃO aparecem nas respostas** (apenas internamente para controle de fluxo)

### `/chat/hybrid` - Fluxo Híbrido de Produção

> **Uso:** WhatsApp via Z-API ou Website
> **Autenticação:** CPF + Telefone (manual no WEB, automático no MOBILE)
> **API:** RADE Produção

#### 🔐 Fluxo de Autenticação - MOBILE (WhatsApp)

**Passo 1:** Mensagem inicial
```
📤 VOCÊ: Olá

💬 BOT: Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1 - Sou Estudante
2 - Sou Coordenador
3 - Ainda não sou usuário
```

**Passo 2:** Escolha de perfil
```
📤 VOCÊ: 1

💬 BOT: Entendido. Para continuar, por favor, informe seu CPF (apenas números).
```

**Passo 3:** Informar CPF + Validação (telefone automático do Z-API)
```
📤 VOCÊ: 98765432100

💬 BOT: Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Conversar com Atendente Virtual
8 - Voltar ao menu inicial
9 - Encerrar atendimento
```

> ✅ **Validação:** O sistema busca dados do estudante na API RADE Produção usando o CPF. O **telefone vem automaticamente do Z-API**, não é solicitado.

#### 🔐 Fluxo de Autenticação - WEB (Site)

**Igual ao ambiente de teste**, mas **SEM prefixo `[TESTE]`**:

```
📤 VOCÊ: 1

💬 BOT: Entendido. Para continuar, por favor, informe seu CPF (apenas números).

📤 VOCÊ: 98765432100

💬 BOT: Ótimo! Agora, por favor, informe seu número de telefone (com DDD, exemplo: 11999999999):

📤 VOCÊ: 11999999999

💬 BOT: Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
...
```

#### 📚 Menu do Estudante

Todas as opções são **idênticas ao ambiente de teste**, com as seguintes diferenças:

1. **SEM prefixo `[TESTE]`** nas mensagens
2. **SEM estados visíveis** (🔄 Estado: X)
3. **API RADE Produção** em vez de Staging

**Opção 7: Conversar com Atendente Virtual**

**MOBILE (WhatsApp):**
```
📤 VOCÊ: 7

💬 BOT: Autenticado com sucesso! Como posso ajudá-lo?

Digite "voltar" para retornar ao menu principal ou "sair" para encerrar.
```

**WEB (Site):**
```
📤 VOCÊ: 7

💬 BOT: Autenticado com sucesso! Como posso ajudá-lo?

Digite "voltar" para retornar ao menu principal ou "sair" para encerrar.
```

> ✅ **Importante:** Em ambos os casos (WEB e MOBILE), o telefone já foi coletado anteriormente, então vai **direto para o chat com IA**.

#### 🔄 Transferência para Atendimento Humano

**MOBILE (WhatsApp):**
```
📤 VOCÊ: 2 (após assistir algum vídeo)

💬 BOT: ✅ Transferência realizada com sucesso!

Isabel Suporte Rade irá entrar em contato com você pelo número 5581XXXXXXXXX.

O atendimento será encerrado agora. Aguarde o contato!
```

**WEB (Site):**
```
📤 VOCÊ: 2 (após assistir algum vídeo)

💬 BOT: ✅ Transferência realizada com sucesso!

Isabel Suporte Rade irá entrar em contato com você pelo número 5581XXXXXXXXX.

O atendimento será encerrado agora. Aguarde o contato!
```

> ✅ **Importante:** Em ambos os casos, o telefone já foi coletado, então **não pede telefone** para transferência.

---

### `/chat/open` - Chat Aberto de Produção

> **Uso:** WhatsApp via Z-API ou Website
> **Autenticação:** CPF + Telefone (manual no WEB, automático no MOBILE)
> **API:** RADE Produção

#### Fluxo Completo - MOBILE (WhatsApp)

**Passo 1:** Primeira mensagem
```
📤 VOCÊ: Olá

💬 BOT: Bem-vindo ao Chat com IA RADE!

Para começar, por favor informe seu CPF (apenas números):
```

**Passo 2:** Informar CPF + Validação (telefone automático do Z-API)
```
📤 VOCÊ: 98765432100

💬 BOT: Olá, Joaquim José da Silva Xavier! Você está autenticado.

Pode fazer suas perguntas sobre o sistema RADE!
```

> ✅ **Validação:** O sistema busca dados na API RADE Produção usando o CPF. O **telefone vem automaticamente do Z-API**.

**Passo 3:** Conversa livre com IA
```
📤 VOCÊ: quais são as minhas atividades agendadas?

💬 BOT: Você tem 2 atividades agendadas:

1. Plantão Médico
   • Local: Hospital Universitário
   • Data: 15/10/2025
   • Horário: 08:00 - 12:00
   • Preceptores: Dr. João Silva, Dra. Maria Santos

2. Ambulatório
   • Local: Clínica Médica
   • Data: 18/10/2025
   • Horário: 14:00 - 18:00
   • Preceptores: Dr. Pedro Costa
```

#### Fluxo Completo - WEB (Site)

**Passo 1:** Primeira mensagem
```
📤 VOCÊ: Olá

💬 BOT: Bem-vindo ao Chat com IA RADE!

Para começar, por favor informe seu CPF (apenas números):
```

**Passo 2:** Informar CPF
```
📤 VOCÊ: 98765432100

💬 BOT: Ótimo! Agora, por favor informe seu número de telefone com DDD (exemplo: 11999999999):
```

**Passo 3:** Informar telefone + Validação
```
📤 VOCÊ: 11999999999

💬 BOT: Olá, Joaquim José da Silva Xavier! Você está autenticado.

Pode fazer suas perguntas sobre o sistema RADE!
```

**Passo 4:** Conversa livre com IA
```
📤 VOCÊ: quais são as minhas atividades agendadas?

💬 BOT: Você tem 2 atividades agendadas:
...
```

---

### `/chat/closed` - Chat Fechado de Produção

> **Uso:** WhatsApp via Z-API ou Website
> **Autenticação:** CPF + Telefone (manual no WEB, automático no MOBILE)
> **API:** RADE Produção

#### Fluxo Completo

**Igual ao `/chat/hybrid`**, mas **SEM a opção 7 (Conversar com Atendente Virtual)**.

**MOBILE (WhatsApp) - Menu do Estudante:**
```
📤 VOCÊ: 98765432100 (após escolher estudante)

💬 BOT: Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Voltar ao menu inicial
8 - Encerrar atendimento
```

**WEB (Site) - Menu do Estudante:**
```
📤 VOCÊ: 11999999999 (após informar CPF e telefone)

💬 BOT: Olá, Joaquim José da Silva Xavier! Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Voltar ao menu inicial
8 - Encerrar atendimento
```

> ❌ **Diferença:** Não possui chat com IA. Apenas menu estruturado.

---

## 📊 Comparação de Ambientes

### Tabela Completa de Endpoints

| Endpoint | Prefixo | API | Chat IA? | Environment |
|----------|---------|-----|----------|-------------|
| `/chat/test_hybrid` | `[TESTE]` | Staging | ✅ Sim | Sempre WEB |
| `/chat/test_open` | `[TESTE]` | Staging | ✅ Sim | Sempre WEB |
| `/chat/test_closed` | `[TESTE]` | Staging | ❌ Não | Sempre WEB |
| `/chat/hybrid` | - | Produção | ✅ Sim | WEB ou MOBILE |
| `/chat/open` | - | Produção | ✅ Sim | WEB ou MOBILE |
| `/chat/closed` | - | Produção | ❌ Não | WEB ou MOBILE |

### Comportamento por Environment

| Aspecto | WEB | MOBILE |
|---------|-----|--------|
| **Solicita telefone?** | ✅ Sim (após CPF) | ❌ Não |
| **Origem do telefone** | Usuário digita | Z-API detecta |
| **Validação** | CPF + Telefone juntos | Apenas CPF |
| **Quando valida?** | Após telefone | Após CPF |
| **Mensagem após validação** | "Olá, [Nome]!" | "Olá, [Nome]!" |

### Momento da Validação

#### 🌐 WEB
```
1. Pede CPF (valida apenas formato - 11 dígitos)
2. Pede TELEFONE (valida apenas formato - 10-11 dígitos)
3. VALIDA CPF + TELEFONE na API RADE
4. Mostra mensagem: "Olá, [Nome]!"
5. Exibe menu
```

#### 📱 MOBILE
```
1. Pede CPF (valida apenas formato - 11 dígitos)
2. VALIDA CPF na API RADE (telefone vem do Z-API)
3. Mostra mensagem: "Olá, [Nome]!"
4. Exibe menu
```

### URLs de Vídeos

#### Estudantes
| Opção | Descrição | URL |
|-------|-----------|-----|
| 1 | Como fazer meu cadastro | `https://rade.b-cdn.net/bot/videos/cadastro.mp4` |
| 2 | Como agendar minhas atividades | `https://rade.b-cdn.net/bot/videos/agendamento-atividades.mp4` |
| 3 | Como iniciar e finalizar atividade | `https://rade.b-cdn.net/bot/videos/iniciar-finalizar-atividade.mp4` |
| 4 | Como fazer uma avaliação | `https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4` |
| 5 | Como justificar atividade perdida | `https://rade.b-cdn.net/bot/videos/justificar-atividade-perdida.mp4` |
| 6 | Como preencher meu TCE | `https://rade.b-cdn.net/bot/videos/preencher-tce.mp4` |

#### Coordenadores
| Opção | Descrição | URL |
|-------|-----------|-----|
| 1 | Como validar atividades | `https://rade.b-cdn.net/bot/videos/validar-rejeitar-atividades.mp4` |
| 2 | Como realizar avaliação | `https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4` |
| 3 | Como baixar aplicativo para preceptores | `https://rade.b-cdn.net/bot/videos/rade-profissional-funcionalidades.mp4` |
| 4 | Como gerar QR code | `https://rade.b-cdn.net/bot/videos/gerar-qr-code.mp4` |

---

## 📬 Sistema de Notificações

### Como Funciona a Transferência para Atendente

Quando um usuário escolhe "2 - Não, preciso de mais ajuda" após visualizar um vídeo, ou escolhe "3 - Ainda não sou usuário", o sistema realiza os seguintes passos:

#### 1. Identificação e Validação
- Busca os dados completos do usuário na API RADE (por CPF)
- Identifica a universidade/instituição do usuário
- Verifica se há atendente disponível para aquela instituição

#### 2. Geração de Resumo
- Cria um resumo contextualizado da conversa usando IA (Gemini)
- Inclui:
  - Tipo de usuário (estudante/coordenador)
  - CPF informado
  - Telefone informado
  - Motivo da transferência
  - Histórico da conversa no fluxo

#### 3. Preparação dos Dados

O sistema formata os dados do usuário:

```
👤 DADOS DO USUÁRIO:
Nome: João Silva
E-mail: joao@email.com
Telefone: 11999999999

📚 GRUPOS:
• GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG

🏫 INSTITUIÇÕES E CURSOS:
• Wyden Unifavip
  - Administração

❓ CONTEXTO:
Encontrou dificuldades em: Como fazer meu cadastro
```

#### 4. Notificação via WhatsApp

A atendente recebe uma mensagem no WhatsApp:

**Para transferências de ajuda:**
```
🚨 NOVO CHAMADO - WYDEN UNIFAVIP

👤 DADOS DO USUÁRIO:
Nome: João Silva
E-mail: joao@email.com
Telefone: 11999999999

📚 GRUPOS:
• GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG

🏫 INSTITUIÇÕES E CURSOS:
• Wyden Unifavip
  - Administração

❓ CONTEXTO:
Encontrou dificuldades em: Como fazer meu cadastro

🕐 SOLICITADO EM: 04/10/2025, 14:30:15
```

**Para novos cadastros:**
```
🆕 NOVO CADASTRO - WYDEN UNIFAVIP

📝 DADOS INFORMADOS:
João Silva, CPF 12345678901, Wyden Unifavip, Medicina, 3º período

🕐 SOLICITADO EM: 04/10/2025, 14:30:15
```

#### 5. Configuração de Atendentes

As atendentes são configuradas via variáveis de ambiente:

```bash
ATENDENTE_ISABEL_NOME=Isabel Suporte Rade
ATENDENTE_ISABEL_TELEFONE=5581XXXXXXXXX
ATENDENTE_ISABEL_UNIVERSIDADES=Zarns Salvador,Inapós,Imepac,...

ATENDENTE_KALINA_NOME=Kalina assistente Rade
ATENDENTE_KALINA_TELEFONE=5581XXXXXXXXX
ATENDENTE_KALINA_UNIVERSIDADES=Franco Montoro,Unisa,...
```

#### 6. Resposta para o Usuário

Após processar tudo, o usuário recebe:

**Endpoints de Teste:**
```
✅ [TESTE] Transferência realizada com sucesso!

Isabel Suporte Rade irá entrar em contato com você pelo número 5581XXXXXXXXX.

O atendimento será encerrado agora. Aguarde o contato!
```

**Endpoints de Produção:**
```
✅ Transferência realizada com sucesso!

Isabel Suporte Rade irá entrar em contato com você pelo número 5581XXXXXXXXX.

O atendimento será encerrado agora. Aguarde o contato!
```

### Diferenças na Transferência

| Aspecto | Teste | Produção WEB | Produção MOBILE |
|---------|-------|--------------|-----------------|
| **Solicita telefone** | ❌ Não (coletado no início) | ❌ Não (coletado no início) | ❌ Não (Z-API) |
| **Prefixo mensagem** | `[TESTE]` | - | - |
| **Notificação WhatsApp** | Enviada | Enviada | Enviada |
| **Formato dados** | Idêntico | Idêntico | Idêntico |

---

## 📝 Observações Importantes

1. **Estados Internos vs Respostas:**
   - Estados como `AWAITING_CPF`, `AI_CHAT`, etc. são **apenas internos**
   - **NÃO aparecem** nas respostas do bot para o usuário
   - São usados apenas para controle de fluxo no backend

2. **Environment é Flexível:**
   - Qualquer endpoint de produção (`/chat/hybrid`, `/chat/open`, `/chat/closed`) pode ser usado em WEB ou MOBILE
   - O comportamento é determinado pelo parâmetro `environment` na requisição
   - Endpoints de teste (`/chat/test_*`) sempre usam `environment: WEB`

3. **Validação de Dados:**
   - **WEB:** Valida CPF + Telefone juntos na API após coletar ambos
   - **MOBILE:** Valida apenas CPF na API (telefone vem do Z-API)
   - Em ambos os casos, mostra "Olá, [Nome]!" após validação bem-sucedida

---

_Última atualização: 07/10/2025_
