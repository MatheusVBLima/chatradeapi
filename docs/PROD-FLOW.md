# 📱 FLUXO DE PRODUÇÃO - MOBILE (WhatsApp Z-API)

## 🎯 Ambiente de Produção

**Configuração:**
- `NODE_ENV=production`
- `CHAT_ENVIRONMENT=MOBILE`
- `USE_API_DATA=true`
- `RADE_API_BASE_URL=https://api.radeapp.com`
- Endpoint: `POST /zapi/webhook` (recebe mensagens do WhatsApp)
- Controller: `HybridChatController` em `/chat/hybrid`

---

## ⚡ DIFERENÇA CRÍTICA: MOBILE vs WEB

### 📱 MOBILE (Produção - WhatsApp Z-API)
- ✅ **Telefone capturado AUTOMATICAMENTE** do Z-API
- ✅ Usuário digita **APENAS o CPF**
- ✅ Sistema valida **CPF + Telefone** juntos
- ✅ **NÃO solicita** telefone ao usuário

### 💻 WEB (Frontend - Navegador)
- ⚠️ **Telefone NÃO é automático**
- ⚠️ Usuário digita **CPF + Telefone**
- ⚠️ Sistema **solicita** telefone após CPF

**🎯 Neste documento:** Foco no fluxo **MOBILE** de produção!

---

## 📋 FLUXO COMPLETO PASSO A PASSO

### 1️⃣ INÍCIO DA CONVERSA

**Usuário envia qualquer mensagem no WhatsApp:**
```
Usuário: "Olá"
ou
Usuário: "Boa tarde"
ou
Usuário: "Preciso de ajuda"
ou
Usuário: [qualquer texto]
```

**Sistema:**
1. Z-API recebe mensagem via webhook
2. Extrai telefone automaticamente (formato: `5511999999999`)
3. Verifica se existe sessão ativa
4. Se não existir: cria nova sessão com estado `START`

**Bot responde:**
```
🤖 Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1️⃣ Sou Estudante
2️⃣ Sou Coordenador
3️⃣ Ainda não sou usuário
```

---

## 🎓 FLUXO 1: ESTUDANTE

### Passo 1: Seleção de Perfil
```
Usuário: 1

Bot: Entendido. Para continuar, por favor, informe seu CPF (apenas números).
```

### Passo 2: Autenticação CPF (Telefone Automático via Z-API)
```
Usuário: 12345678900

Bot: Olá, [Nome do Estudante]! Aqui estão as opções que posso te ajudar:

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

**Sistema (MOBILE - Automático):**
1. Busca estudante na API RADE pelo CPF informado
2. **Pega telefone automaticamente do Z-API** (número do WhatsApp que está conversando)
3. Valida se CPF + telefone combinam nos dados da API RADE
4. Se **CPF válido** e **telefone correto**: ✅ Autentica e mostra menu imediatamente
5. Se **CPF válido** mas **telefone incorreto**: ❌ Rejeita com mensagem de erro
6. Se **CPF inválido**: ❌ Rejeita com mensagem de erro

**⚠️ IMPORTANTE:**
- Em MOBILE, o telefone **NUNCA** é solicitado ao usuário!
- O Z-API fornece automaticamente o número do WhatsApp
- Validação é **CPF + Telefone** juntos contra a API RADE

### Passo 4A: Opção 1 - Ver Atividades Agendadas
```
Usuário: 1

Bot: 📅 Suas Atividades Agendadas:

     1. Estágio em Clínica Médica
        Grupo: Turma 2024.1
        Local: Hospital Central
        Data: 15/01/2025
        Horário: 08:00 - 12:00
        Preceptores: Dr. João Silva, Dra. Maria Santos

     2. Laboratório de Anatomia
        Grupo: Turma 2024.1
        Local: Lab. Anatomia - Bloco A
        Data: 16/01/2025
        Horário: 14:00 - 18:00
        Preceptores: Prof. Carlos Lima

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

### Passo 4B: Opção 2 - Ver Preceptores
```
Usuário: 2

Bot: 👨‍⚕️ Seus Preceptores/Professores:

     1. Dr. João Silva
        Email: joao.silva@hospital.com
        Telefone: 11988887777
        Grupos: Turma 2024.1

     2. Dra. Maria Santos
        Email: maria.santos@hospital.com
        Telefone: 11977776666
        Grupos: Turma 2024.1

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

### Passo 4C: Opção 3 - Ver Dados Cadastrais
```
Usuário: 3

Bot: 📋 Seus Dados Cadastrais:

     • Nome: João da Silva Junior
     • Email: joao.silva@email.com
     • Telefone: 11999999999
     • Grupo: Turma 2024.1 - Medicina
     • Curso: Medicina na Universidade Federal

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

### Passo 4D: Opção 4 - Buscar Pessoa
```
Usuário: 4

Bot: 🔍 Busca de Pessoas

     Por favor, digite o nome da pessoa que deseja buscar:

Usuário: Maria Santos

Bot: 🔍 Resultado da Busca:

     👤 Dra. Maria Santos
     CPF: 123.456.789-00
     Email: maria.santos@hospital.com
     Telefone: 11977776666
     Grupos: Turma 2024.1

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

### Passo 4E: Opção 5 - Reportar Problema
```
Usuário: 5

Bot: 📢 Reportar Problema

     Por favor, descreva detalhadamente o problema que você está enfrentando.
     Nossa equipe receberá sua mensagem.

Usuário: O sistema não está registrando minhas horas de estágio corretamente

Bot: ✅ Seu problema foi reportado com sucesso!

     Detalhes registrados:
     • Problema: O sistema não está registrando minhas horas de estágio corretamente
     • Reportado por: João da Silva Junior (11999999999)
     • Data/Hora: 11/10/2025 às 14:30
     • Universidade: Universidade Federal

     Nossa equipe técnica receberá uma notificação e entrará em contato em breve.

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

**🔔 Notificação enviada ao atendente responsável:**
```
🆘 PROBLEMA REPORTADO

📝 DESCRIÇÃO:
O sistema não está registrando minhas horas de estágio corretamente

👤 USUÁRIO:
Nome: João da Silva Junior
Telefone: 11999999999
Universidade: Universidade Federal

🕐 REPORTADO EM: 11/10/2025 às 14:30
```

### Passo 4F: Opção 6 - Falar com Atendente Humano
```
Usuário: 6

Bot: 🤝 Transferência para Atendente Humano

     Você será transferido para um atendente humano.
     Por favor, aguarde enquanto verificamos a disponibilidade.

     Para continuar, informe seu número de telefone (com DDD):

Usuário: 11999999999

Bot: ✅ Solicitação de atendimento registrada!

     📋 Informações:
     • Posição na fila: 1
     • Atendente responsável: Maria Silva (Universidade Federal)
     • Tempo estimado de espera: 5 minutos

     Você receberá uma mensagem assim que o atendente estiver disponível.
     Enquanto isso, fique à vontade para enviar informações adicionais sobre sua dúvida.
```

**🔔 Notificação enviada ao atendente:**
```
🔔 NOVO CHAMADO NA FILA

👤 ESTUDANTE:
Nome: João da Silva Junior
Telefone: 11999999999
Universidade: Universidade Federal

📊 FILA ATUAL: 1 pessoa(s) aguardando

🕐 SOLICITADO EM: 11/10/2025 às 14:30

⚡ Para atender, acesse: [link ou responda ao usuário]
```

### Passo 4G: Opção 7 - Conversar com IA
```
Usuário: 7

Bot: 🤖 Atendente Virtual (IA)

     Olá! Sou o assistente virtual da RADE.
     Posso ajudá-lo com:

     • Consultar suas atividades e preceptores
     • Buscar informações no sistema
     • Gerar relatórios personalizados
     • Responder dúvidas sobre o sistema

     Como posso ajudá-lo?

Usuário: Quais minhas próximas atividades?

Bot: 📅 Consultando suas próximas atividades...

     Você tem 2 atividades agendadas:

     1. **Estágio em Clínica Médica**
        📍 Hospital Central
        📅 15/01/2025 das 08:00 às 12:00
        👨‍⚕️ Dr. João Silva, Dra. Maria Santos

     2. **Laboratório de Anatomia**
        📍 Lab. Anatomia - Bloco A
        📅 16/01/2025 das 14:00 às 18:00
        👨‍🏫 Prof. Carlos Lima

     Posso ajudar com mais alguma coisa?

Usuário: Gere um relatório PDF com essas atividades

Bot: 📄 Gerando relatório em PDF...

     ✅ Relatório gerado com sucesso!

     🔗 Download: http://api.radeapp.com/reports/from-cache/abc123-def456/pdf

     O link ficará disponível por 20 minutos.

     Posso ajudar com mais alguma coisa?

Usuário: voltar

Bot: ✅ Autenticação realizada com sucesso!

     Olá, João da Silva Junior!

     Como posso ajudá-lo hoje? Escolha uma opção:
     [menu principal novamente]
```

### Passo 5: Encerrar Atendimento
```
Usuário: 9
ou
Usuário: sair

Bot: 👋 Atendimento finalizado com sucesso!

     Obrigado por usar nosso serviço.
     Para iniciar uma nova conversa, envie "oi" a qualquer momento.
```

**Sistema:** Sessão é deletada após 5 segundos

---

## 👔 FLUXO 2: COORDENADOR

### Passo 1: Seleção de Perfil
```
Usuário: 2

Bot: Entendido. Para continuar, por favor, informe seu CPF (apenas números).
```

### Passo 2: Autenticação CPF (Telefone Automático via Z-API)
```
Usuário: 98765432100

Bot: ✅ Autenticação realizada com sucesso!

     Olá, [Nome do Coordenador]!

     Como posso ajudá-lo hoje? Escolha uma opção:

     1️⃣ Ver atividades em andamento
     2️⃣ Ver profissionais supervisionados
     3️⃣ Ver estudantes supervisionados
     4️⃣ Buscar uma pessoa por nome
     5️⃣ Reportar um problema
     6️⃣ Falar com atendente
     7️⃣ Conversar com Atendente Virtual (IA)
     8️⃣ Voltar ao menu anterior
     9️⃣ Sair
```

**Sistema (MOBILE - Automático):**
- Mesmo funcionamento do fluxo de Estudante
- Telefone capturado automaticamente do Z-API
- Validação CPF + Telefone contra API RADE
- Menu de coordenador exibido imediatamente após validação

### Passo 4A: Opção 1 - Atividades em Andamento
```
Usuário: 1

Bot: 🏃 Atividades em Andamento Agora:

     1. João da Silva
        Grupo: Turma 2024.1
        Atividade: Estágio em Clínica Médica
        Local: Hospital Central
        Data: 11/10/2025
        Horário: 08:00 - 12:00
        Preceptor: Dr. João Silva

     2. Maria Santos
        Grupo: Turma 2024.1
        Atividade: Laboratório de Anatomia
        Local: Lab. Anatomia - Bloco A
        Data: 11/10/2025
        Horário: 10:00 - 14:00
        Preceptor: Prof. Carlos Lima

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

### Passo 4B: Opção 2 - Profissionais Supervisionados
```
Usuário: 2

Bot: 👨‍⚕️ Profissionais Supervisionados:

     1. Dr. João Silva
        Email: joao.silva@hospital.com
        Telefone: 11988887777
        Grupos: Turma 2024.1
        Horas pendentes: 120 min

     2. Prof. Carlos Lima
        Email: carlos.lima@universidade.edu
        Telefone: 11977776666
        Grupos: Turma 2024.1, Turma 2024.2
        Horas pendentes: 0 min

     Digite o número da opção desejada ou "voltar" para retornar ao menu.
```

### Passo 4C: Opção 3 - Estudantes Supervisionados
```
Usuário: 3

Bot: 📚 Buscando estudantes supervisionados...

     ⚠️ ATENÇÃO: Você supervisiona 45 estudantes.

     Para evitar mensagens muito longas, utilize o Atendente Virtual (opção 7)
     para fazer buscas específicas ou gerar relatórios.

     Deseja continuar mesmo assim?

     Digite "sim" para continuar ou "voltar" para retornar ao menu.

Usuário: voltar

Bot: [Volta ao menu do coordenador]
```

---

## 🆕 FLUXO 3: NOVO USUÁRIO (NÃO CADASTRADO)

### Passo 1: Seleção de Perfil
```
Usuário: 3

Bot: Ok. Para realizar seu cadastro inicial, por favor, me diga seu nome completo,
     CPF, instituição, curso e período, tudo em uma única mensagem.
```

### Passo 2: Envio de Dados
```
Usuário: João Silva, CPF 12345678900, Universidade Federal, Medicina, 3º período

Bot: 📝 Processando seus dados...
```

**Sistema:**
1. Extrai instituição usando IA (Gemini)
2. Busca atendente responsável pela instituição
3. Valida se instituição está cadastrada

### Passo 3A: Instituição Encontrada ✅
```
Bot: ✅ Obrigado! Seus dados foram recebidos e encaminhados para Maria Silva,
     responsável pela Universidade Federal.

     Em breve entraremos em contato para finalizar seu cadastro.
     O atendimento será encerrado.
```

**🔔 Notificação enviada ao atendente:**
```
🆕 NOVO CADASTRO - Universidade Federal

📝 DADOS INFORMADOS:
João Silva, CPF 12345678900, Universidade Federal, Medicina, 3º período

🕐 SOLICITADO EM: 11/10/2025 às 14:30
```

### Passo 3B: Instituição Não Cadastrada ❌
```
Bot: Obrigado pelos seus dados! Infelizmente, a instituição "XYZ University"
     não faz parte da nossa lista de atendimento no momento.

     Por favor, entre em contato diretamente com sua instituição ou
     utilize nosso atendimento automático.

     O atendimento será encerrar.
```

### Passo 3C: Instituição Não Identificada ⚠️
```
Bot: ❌ Não consegui identificar sua instituição.
     Por favor, informe novamente seus dados incluindo o nome completo da instituição.

Usuário: [Envia dados novamente com instituição mais clara]
```

---

## 🔄 REINÍCIO DE CONVERSA

### Após Encerramento Normal
```
(Usuário já finalizou um atendimento)

Usuário: Oi

Bot: 🤖 Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

     1️⃣ Sou Estudante
     2️⃣ Sou Coordenador
     3️⃣ Ainda não sou usuário

(Fluxo recomeça do zero)
```

### Após Inatividade (20 minutos)
```
(Sessão expira automaticamente após 20 minutos sem resposta)

Usuário: [Qualquer mensagem]

Bot: 🤖 Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:
     [menu inicial]
```

---

## 🎨 FORMATO DAS MENSAGENS

### ✅ Características das Mensagens do Bot:

1. **Sem Prefixos de Debug:**
   - ❌ Não aparece: `[TESTE]`
   - ❌ Não aparece: `🔄 Estado: XXX`
   - ✅ Apenas texto limpo e profissional

2. **Emojis Apropriados:**
   - 🤖 Boas-vindas e IA
   - ✅ Confirmações e sucessos
   - ❌ Erros e validações
   - 📋 Dados e informações
   - 🔔 Notificações
   - 👋 Despedidas

3. **Formatação Clara:**
   - Números para opções (1️⃣, 2️⃣, 3️⃣...)
   - Quebras de linha para legibilidade
   - Separação visual de seções

4. **Tom Profissional e Amigável:**
   - Tratamento respeitoso
   - Instruções claras
   - Feedback constante

---

## 🔔 NOTIFICAÇÕES PARA ATENDENTES

### Tipo 1: Reportar Problema
```
🆘 PROBLEMA REPORTADO

📝 DESCRIÇÃO:
[Texto do problema relatado pelo usuário]

👤 USUÁRIO:
Nome: [Nome Completo]
Telefone: [11999999999]
Universidade: [Nome da Universidade]

🕐 REPORTADO EM: [DD/MM/YYYY às HH:MM]
```

### Tipo 2: Solicitação de Atendente Humano
```
🔔 NOVO CHAMADO NA FILA

👤 [ESTUDANTE/COORDENADOR]:
Nome: [Nome Completo]
Telefone: [11999999999]
Universidade: [Nome da Universidade]

📊 FILA ATUAL: [X] pessoa(s) aguardando

🕐 SOLICITADO EM: [DD/MM/YYYY às HH:MM]
```

### Tipo 3: Novo Cadastro
```
🆕 NOVO CADASTRO - [Nome da Universidade]

📝 DADOS INFORMADOS:
[Dados completos fornecidos pelo usuário]

🕐 SOLICITADO EM: [DD/MM/YYYY às HH:MM]
```

---

## ⚠️ MENSAGENS DE ERRO

### Erro de Autenticação - CPF Inválido
```
Bot: ❌ CPF não encontrado em nossa base de dados.

     Verifique se digitou corretamente ou escolha a opção 3
     no menu inicial se ainda não for cadastrado.

     Digite seu CPF novamente ou "voltar" para retornar ao menu.
```

### Erro de Autenticação - Telefone Inválido
```
Bot: ❌ O telefone informado não corresponde ao cadastrado no sistema.

     Por favor, informe o telefone correto (com DDD) ou entre em
     contato com sua instituição para atualizar seus dados.

     Digite seu telefone novamente ou "voltar" para retornar ao menu.
```

### Erro de Conexão com API
```
Bot: ❌ Desculpe, estamos com instabilidade temporária no sistema.

     Por favor, tente novamente em alguns instantes.

     Digite qualquer mensagem para tentar novamente ou "sair" para encerrar.
```

### Erro Genérico
```
Bot: ❌ Ocorreu um erro inesperado ao processar sua solicitação.

     Nossa equipe técnica foi notificada e estamos trabalhando para resolver.

     Por favor, tente novamente mais tarde ou entre em contato com o suporte.
```

---

## 🔐 SEGURANÇA E VALIDAÇÕES

### Autenticação de 2 Fatores:
1. ✅ CPF validado contra API RADE
2. ✅ Telefone validado contra dados do usuário
3. ✅ Sessão armazenada com timeout de 20 minutos

### Proteção de Dados:
- ✅ CPF nunca exibido completo em logs
- ✅ Telefone capturado automaticamente via Z-API
- ✅ Dados sensíveis não armazenados em cache permanente

### Rate Limiting:
- ✅ 30 requisições por minuto por número
- ✅ Proteção contra spam/flood

---

## ✅ CHECKLIST DE VALIDAÇÃO PARA PRODUÇÃO

### Antes do Deploy:

- [ ] Variáveis de ambiente corretas (`.env.production`)
- [ ] `CHAT_ENVIRONMENT=MOBILE` configurado
- [ ] `USE_API_DATA=true` configurado
- [ ] `RADE_API_BASE_URL=https://api.radeapp.com` (produção)
- [ ] Z-API configurado com tokens de produção
- [ ] Lista de atendentes atualizada em `.env.production`
- [ ] Webhook Z-API apontando para servidor de produção
- [ ] SSL/TLS configurado (HTTPS)
- [ ] Rate limiting ativado

### Testes Críticos:

- [ ] Fluxo completo estudante (CPF válido + telefone válido)
- [ ] Fluxo completo coordenador (CPF válido + telefone válido)
- [ ] Fluxo novo usuário (instituição válida)
- [ ] Fluxo novo usuário (instituição inválida)
- [ ] Notificações chegando aos atendentes corretos
- [ ] Relatórios sendo gerados corretamente
- [ ] IA respondendo adequadamente (opção 7)
- [ ] Transferência para atendente humano (opção 6)
- [ ] Reportar problema com notificação (opção 5)
- [ ] Reinício de conversa após encerramento
- [ ] Timeout de sessão (20 minutos)
- [ ] Erro de CPF inválido
- [ ] Erro de telefone inválido

### Monitoramento:

- [ ] Logs de erro sendo capturados
- [ ] Métricas de uso sendo registradas
- [ ] Alertas configurados para falhas críticas
- [ ] Backup de dados sensíveis

---

## 📞 CONTATOS E SUPORTE

**Em caso de problemas em produção:**
- Verificar logs do servidor
- Verificar status da API RADE
- Verificar status do Z-API
- Verificar conectividade com Gemini AI

**Equipe Responsável:**
- Backend: [Seu nome/equipe]
- Atendentes: Configurados em `.env.production`
- Suporte Técnico: [Contato de emergência]

---

**Documentação gerada em:** 11/10/2025
**Versão:** 1.0
**Ambiente:** Produção (MOBILE - WhatsApp Z-API)
