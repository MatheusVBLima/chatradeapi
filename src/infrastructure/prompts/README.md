# Sistema de Prompts

Este diretório contém os prompts organizados em arquivos separados para melhor manutenibilidade e edição.

## Estrutura

```
src/infrastructure/prompts/
├── README.md                   # Este arquivo
├── student.prompt.md          # Prompt para estudantes
├── coordinator.prompt.md      # Prompt para coordenadores
└── (futuros prompts...)
```

## Como Funciona

1. **PromptService** (`src/infrastructure/services/prompt.service.ts`) carrega os arquivos
2. **GeminiAIService** usa o PromptService para obter o prompt correto
3. **Placeholders** são substituídos automaticamente:
   - `{{CPF}}` → CPF do usuário
   - `{{NAME}}` → Nome do usuário  
   - `{{ROLE}}` → Papel do usuário (Estudante/Coordenador)

## Editando Prompts

### Para modificar prompts:
1. Edite diretamente os arquivos `.prompt.md` 
2. Use Markdown para formatação
3. As alterações são aplicadas automaticamente (sem restart)

### Exemplo de uso de placeholders:
```markdown
Usuário atual: {{NAME}} (Perfil: {{ROLE}})
CPF do usuário: {{CPF}}
```

## Vantagens

✅ **Legibilidade**: Prompts em arquivos separados são mais fáceis de ler
✅ **Manutenção**: Editar prompts sem mexer no código TypeScript
✅ **Versionamento**: Prompts podem ser versionados independentemente
✅ **Colaboração**: Diferentes pessoas podem editar prompts sem conflitos
✅ **Backup**: Fallback automático se arquivo não for encontrado

## Fallback

Se um arquivo de prompt não for encontrado, o sistema usa um prompt básico de fallback para garantir que o chatbot continue funcionando.