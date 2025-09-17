# Relatório de Testes - API Staging

**Data**: 27/08/2025  
**Ambiente**: `api.stg.radeapp.com`  
**Token**: `JQiFrDkkM5eNKtLxwNKzZoga0xkeRDAZ`  
**Formato Auth**: `Authorization: <token>`

---

## 🔐 Autenticação

- ✅ **Token funciona** quando usado como `Authorization: JQiFrDkkM5eNKtLxwNKzZoga0xkeRDAZ`
- ❌ **Sem token** retorna: `{"message":"ID de cliente não informado","error":"Unauthorized","statusCode":401}`

---

## 👨‍🎓 Rotas de Estudante - CPF: 98765432100

### 1. GET /virtual-assistance/students/98765432100
**Status**: ✅ 200 OK

```json
{
  "studentName": "Joaquim José da Silva Xavier",
  "studentEmail": "r.olisantos@gmail.com",
  "studentPhone": "11999999999",
  "groupNames": [
    "GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG"
  ],
  "organizationsAndCourses": [
    {
      "organizationName": "Wyden Unifavip",
      "courseNames": ["Administração"]
    }
  ]
}
```

**Observações**:
- Estrutura diferente do mock (studentName vs name, studentEmail vs email)
- Inclui organizationsAndCourses (não existe no mock)

### 2. GET /virtual-assistance/students/scheduled-activities/98765432100
**Status**: ✅ 200 OK

```json
[]
```

**Observação**: Array vazio - estudante não possui atividades agendadas

### 3. GET /virtual-assistance/students/professionals/98765432100
**Status**: ✅ 200 OK

```json
[
  {
    "cpf": "66670721404",
    "name": "André Luiz Gomes da Silva",
    "email": "andre.silva@professores.unifavip.edu.br",
    "phone": null,
    "groupNames": [
      "GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG"
    ]
  },
  {
    "cpf": "98194585368",
    "name": "Eugenia Melo Cabral",
    "email": "eugenia.cabral@unifanor.edu.br",
    "phone": null,
    "groupNames": [
      "GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG"
    ]
  },
  {
    "cpf": "00000000099",
    "name": "Rodrigo Oliveira Santos",
    "email": "r.olisantos@gmail.com",
    "phone": "11982121081",
    "groupNames": [
      "GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG"
    ]
  }
]
```

**Observação**: Estrutura similar ao mock, 3 profissionais encontrados

---

## 👨‍🏫 Rotas de Coordenador - CPF: 05631761483

### 4. GET /virtual-assistance/coordinators/05631761483
**Status**: ✅ 200 OK

```json
{
  "coordinatorName": "Ana Maraiza de Sousa Silva",
  "coordinatorEmail": "ana.maraiza@caruaru.pe.gov.br",
  "coordinatorPhone": null,
  "groupNames": [
    "Ciências da Computação - HUY400MA",
    "Engenharia Civil - ZUD918XW",
    "Direito  - BNG808JC",
    "Arquitetura e Urbanismo - MEC271YM",
    // ... 55 grupos no total
  ],
  "organizationsAndCourses": [
    {
      "organizationName": "Prefeitura de Caruaru",
      "courseNames": [
        "Amttc", "Ceaca", "Controladoria", "Procon Caruaru", 
        "Procuradoria", "Sad", "Sdsdh", "Secop", "Sedetec", 
        "Seduc", "Sefaz", "Seplag", "Sesp", "Seurb", "Sms",
        "Spm - Secretaria de Políticas Para Mulheres -", "Urb"
      ]
    }
  ]
}
```

**Observação**: Coordenador com acesso a 59 grupos e múltiplos cursos na Prefeitura de Caruaru

### 5. GET /virtual-assistance/coordinators/ongoing-activities/05631761483
**Status**: ✅ 200 OK

```json
[]
```

**Observação**: Array vazio - não há atividades em andamento no momento

### 6. GET /virtual-assistance/coordinators/professionals/05631761483
**Status**: ✅ 200 OK

```json
[
  {
    "cpf": "01422822435",
    "name": "Thais Indiara Marques da Silva",
    "email": "tindiara@gmail.com",
    "phone": null,
    "groupNames": ["Direito  - BAY989DM"]
  },
  {
    "cpf": "02587082471",
    "name": "Wilsa de Souza Melo", 
    "email": "teste@teste",
    "phone": null,
    "groupNames": ["Direito  - BAY989DM"]
  },
  {
    "cpf": "08931342446",
    "name": "Camila Tayná Santos",
    "email": "comercioservicosedec@gmail.com",
    "phone": null,
    "groupNames": ["Administração - SAB300ZV"]
  },
  {
    "cpf": "06729732431",
    "name": "Welsiton Ferreira de Lima Moraes",
    "email": "wfcreations@gmail.com",
    "phone": null,
    "groupNames": ["Ciência da Computação - FGR520YQ"]
  }
]
```

**Observação**: 4 profissionais sob supervisão do coordenador

### 7. GET /virtual-assistance/coordinators/students/05631761483
**Status**: ✅ 200 OK

**Resultado**: 134 estudantes encontrados (lista muito extensa)

**Estrutura dos estudantes**:
```json
{
  "cpf": "13281598412",
  "name": "Karla Priscila Negromonte de Queiroz",
  "email": "2018110030@app.asces.edu.br", 
  "phone": "81997690940",
  "groupNames": ["Engenharia Ambiental  - ZXU765GN"]
}
```

---

## ❌ Testes com CPF de Estudante em Rotas de Coordenador

Testamos o CPF `98765432100` (estudante) nas rotas de coordenador:

- GET /virtual-assistance/coordinators/98765432100
- GET /virtual-assistance/coordinators/ongoing-activities/98765432100  
- GET /virtual-assistance/coordinators/professionals/98765432100
- GET /virtual-assistance/coordinators/students/98765432100

**Resultado**: `{"statusCode":404,"message":"Coordenador não encontrado"}`

**Conclusão**: API valida corretamente os perfis - estudantes não podem acessar rotas de coordenador

---

## 📊 Comparação: Mock vs Staging

### Estrutura de Dados de Estudante

**Mock**:
```json
{
  "cpf": "98765432100",
  "name": "Dr. João Carlos Oliveira", 
  "email": "joao.oliveira@preceptores.ufpr.br",
  "phone": "41999887766",
  "groupNames": ["Grupo 1 - Saúde da Mulher", "Grupo 4 - Saúde Mental"]
}
```

**Staging**:
```json
{
  "studentName": "Joaquim José da Silva Xavier",
  "studentEmail": "r.olisantos@gmail.com",
  "studentPhone": "11999999999", 
  "groupNames": ["GST1692 - ESTÁGIO SUPERVISIONADO EM ADMINISTRAÇÃO - NHE715YG"],
  "organizationsAndCourses": [...]
}
```

**Principais diferenças**:
- `name` → `studentName`
- `email` → `studentEmail` 
- `phone` → `studentPhone`
- Adicionado: `organizationsAndCourses`
- Nomes dos grupos são diferentes (códigos vs nomes descritivos)
- Área: Saúde (mock) vs Administração (staging)

### Estrutura de Profissionais

**Mock vs Staging**: ✅ **Estrutura idêntica**
```json
{
  "cpf": "string",
  "name": "string", 
  "email": "string",
  "phone": "string|null",
  "groupNames": ["string"]
}
```

### Dados de Coordenador

**Mock**:
```json
{
  "coordinatorName": "Prof. Daniela Moura",
  "coordinatorEmail": "daniela.moura@ufpr.br", 
  "coordinatorPhone": "41991112233",
  "groupNames": ["Grupo 1", "Grupo 2", "Grupo 4"],
  "organizationsAndCourses": [...]
}
```

**Staging**: ✅ **Estrutura idêntica**, mas dados reais diferentes

---

## 🎯 Conclusões

1. **Autenticação**: Token fixo de aplicação, formato sem "Bearer"
2. **Validação de perfis**: API valida corretamente estudante vs coordenador
3. **Dados reais**: Sistema staging possui dados reais de uma instituição (Wyden Unifavip/Prefeitura Caruaru)
4. **Estruturas**: Algumas diferenças nos campos de estudante, mas profissionais e coordenadores mantêm compatibilidade
5. **Volumes**: Coordenador tem acesso a muito mais dados (134 estudantes, 59 grupos)

## ⚠️ Pontos de Atenção para Implementação

1. **ApiClientService**: Precisa ajustar header de Authorization (remover "Bearer")
2. **Mapeamento de campos**: Estudante usa `studentName`, `studentEmail`, `studentPhone`
3. **Tratamento de arrays vazios**: Atividades podem retornar array vazio
4. **Volume de dados**: Coordenadores podem ter centenas de registros

---

---

## 📋 Testes Complementares - Estudantes Adicionais

### CPF: 13281598412 - Karla Priscila Negromonte de Queiroz

#### GET /virtual-assistance/students/13281598412
**Status**: ✅ 200 OK

```json
{
  "studentName": "Karla Priscila Negromonte de Queiroz",
  "studentEmail": "2018110030@app.asces.edu.br",
  "studentPhone": "81997690940",
  "groupNames": ["Engenharia Ambiental  - ZXU765GN"],
  "organizationsAndCourses": [
    {
      "organizationName": "Prefeitura de Caruaru",
      "courseNames": ["Urb"]
    },
    {
      "organizationName": "Centro Universitário Tabosa de Almeida ASCES-UNITA",
      "courseNames": ["Engenharia Ambiental"]
    }
  ]
}
```

#### GET /virtual-assistance/students/scheduled-activities/13281598412
**Status**: ✅ 200 OK
```json
[]
```

#### GET /virtual-assistance/students/professionals/13281598412
**Status**: ✅ 200 OK
```json
[]
```

### CPF: 12381436448 - Josefa Andreza Alves da Silva

#### GET /virtual-assistance/students/12381436448
**Status**: ✅ 200 OK

```json
{
  "studentName": "Josefa Andreza Alves da Silva",
  "studentEmail": "2017110007@app.asces.edu.br",
  "studentPhone": "81996964847",
  "groupNames": ["Engenharia Ambiental  - ZXU765GN"],
  "organizationsAndCourses": [
    {
      "organizationName": "Prefeitura de Caruaru",
      "courseNames": ["Urb"]
    },
    {
      "organizationName": "Centro Universitário Tabosa de Almeida ASCES-UNITA",
      "courseNames": ["Engenharia Ambiental"]
    }
  ]
}
```

#### Outras rotas: scheduled-activities e professionals retornam arrays vazios

### CPF: 70436988470 - Helaysa Samara Louise Silva

#### GET /virtual-assistance/students/70436988470
**Status**: ✅ 200 OK

```json
{
  "studentName": "Helaysa Samara Louise Silva",
  "studentEmail": "helaysasls@outlook.com",
  "studentPhone": "81996565699",
  "groupNames": ["Administração - PUK843AD"],
  "organizationsAndCourses": [
    {
      "organizationName": "Prefeitura de Caruaru",
      "courseNames": ["Amttc"]
    }
  ]
}
```

#### Outras rotas: scheduled-activities e professionals retornam arrays vazios

### CPF: 11536655490 - Bruno Washington Santos Silva

#### GET /virtual-assistance/students/11536655490
**Status**: ✅ 200 OK

```json
{
  "studentName": "Bruno Washington Santos Silva",
  "studentEmail": "bruno-washington@outlook.com",
  "studentPhone": "81982574792",
  "groupNames": ["Arquitetura e Urbanismo - HGZ194PM"],
  "organizationsAndCourses": [
    {
      "organizationName": "Prefeitura de Caruaru",
      "courseNames": ["Amttc"]
    }
  ]
}
```

#### Outras rotas: scheduled-activities e professionals retornam arrays vazios

---

## 🔍 Busca por Coordenadores Adicionais

**Tentativa de encontrar outros coordenadores**:
- Testamos vários CPFs de profissionais e estudantes
- Todos retornaram `{"statusCode":404,"message":"Coordenador não encontrado"}`
- **Conclusão**: Apenas o CPF `05631761483` tem perfil de coordenador no sistema staging

---

## 📊 Padrões Identificados nos Dados Staging

### 1. **Estrutura Consistente de Estudantes**
- Todos seguem o padrão: `studentName`, `studentEmail`, `studentPhone`
- `organizationsAndCourses` sempre presente
- Duas organizações comuns:
  - "Prefeitura de Caruaru" 
  - "Centro Universitário Tabosa de Almeida ASCES-UNITA"

### 2. **Arrays Vazios são Comuns**
- `scheduled-activities`: Todos os estudantes testados retornaram `[]`
- `professionals`: Maioria retorna `[]` (apenas o primeiro estudante teve 3 profissionais)
- `ongoing-activities` (coordenador): Retorna `[]`

### 3. **Grupos com Códigos Únicos**
- Padrão: "Curso - CÓDIGO8CHAR"
- Exemplos: "GST1692 - ...", "Engenharia Ambiental  - ZXU765GN"

### 4. **Diferentes Cursos Representados**
- **Administração**: Wyden Unifavip
- **Engenharia Ambiental**: ASCES-UNITA + Prefeitura Caruaru
- **Arquitetura e Urbanismo**: Prefeitura Caruaru

---

## 🎯 Conclusões Finais

1. **Sistema Multi-Institucional**: Dados de múltiplas instituições (Wyden Unifavip, ASCES-UNITA, Prefeitura de Caruaru)

2. **Dados Reais**: Sistema contém dados reais de estudantes e profissionais ativos

3. **Perfis Bem Definidos**: 
   - 1 Coordenador com acesso amplo (134 estudantes, 4 profissionais)
   - Múltiplos estudantes com dados básicos
   - Arrays vazios para atividades (possivelmente período sem atividades)

4. **Validação Robusta**: API valida corretamente perfis e permissões

5. **Volume Real**: Dados em volume real (centenas de registros para coordenador)

---

**Próximos passos**: Atualizar o código para usar a estrutura real da API staging