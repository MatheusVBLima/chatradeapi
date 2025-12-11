import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class PromptService {
  private readonly promptsPath = this.getPromptsPath();
  // 🔧 Flag para controlar logs verbosos (configurável via .env DEBUG_VERBOSE=true)
  private readonly debugVerbose: boolean;

  constructor(private readonly configService: ConfigService) {
    this.debugVerbose = this.configService.get<string>('DEBUG_VERBOSE') === 'true';
  }

  private getPromptsPath(): string {
    // In production, files are in dist folder, in development they're in src
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      return join(process.cwd(), 'dist', 'infrastructure', 'prompts');
    } else {
      return join(process.cwd(), 'src', 'infrastructure', 'prompts');
    }
  }

  /**
   * Retorna instruções de formatação baseadas no ambiente
   */
  private getFormattingInstructions(environment?: 'web' | 'mobile'): string {
    if (environment === 'web') {
      return `
FORMATAÇÃO DE RESPOSTAS (AMBIENTE WEB - MARKDOWN):

⚠️ REGRAS DE FORMATAÇÃO:
- Use "-" para listas (NÃO use "•")
- Use "**texto**" para negrito
- NÃO pule linha extra entre itens da lista
- Coloque apenas UMA quebra de linha após o título

**Exemplo CORRETO:**
Seus dados:
- **Nome:** João Silva
- **Email:** joao@email.com
- **Telefone:** 11999999999
- **Grupo:** GST1692

**Exemplo INCORRETO (NÃO faça):**
Seus dados: • Nome: João • Email: joao@email.com
`;
    } else {
      // Mobile/WhatsApp - formatação simplificada
      return `
FORMATAÇÃO DE RESPOSTAS (AMBIENTE MOBILE/WHATSAPP):

- Use "*texto*" para negrito (formato WhatsApp)
- Use bullet "•" para listas
- Mantenha tudo em formato de texto simples
- Evite markdown complexo (headers, code blocks)

**Exemplo para mobile:**
Seus dados:
• Nome: João Silva
• Email: joao@email.com
• Telefone: 11999999999
`;
    }
  }

  getSystemPrompt(actor: User): string {
    const isCoordinator = actor.role === 'coordinator';
    const promptFile = isCoordinator ? 'coordinator.prompt.md' : 'student.prompt.md';
    // Obter environment do actor (anotado em open-chat.flow.ts linha 268)
    const environment = (actor as any).environment as 'web' | 'mobile' | undefined;

    try {
      const promptContent = readFileSync(join(this.promptsPath, promptFile), 'utf-8');

      if (this.debugVerbose) {
        console.log(`[PROMPT] Loading ${promptFile} from ${this.promptsPath}`);
        console.log(`[PROMPT] Environment: ${environment}`);
        console.log(`[PROMPT] Content preview: ${promptContent.substring(0, 200)}...`);
      }

      // Obter instruções de formatação baseadas no ambiente
      const formattingInstructions = this.getFormattingInstructions(environment);

      // Replace placeholders with actual user data
      const finalPrompt = promptContent
        .replace(/\{\{CPF\}\}/g, actor.cpf)
        .replace(/\{\{NAME\}\}/g, actor.name)
        .replace(/\{\{ROLE\}\}/g, isCoordinator ? 'Coordenador' : 'Estudante')
        .replace(/\{\{FORMATTING_INSTRUCTIONS\}\}/g, formattingInstructions);

      if (this.debugVerbose) {
        console.log(`[PROMPT] Final prompt preview: ${finalPrompt.substring(0, 300)}...`);
      }
      return finalPrompt;
    } catch (error) {
      console.error(`Error loading prompt file ${promptFile}:`, error);

      // Fallback to basic prompt if file loading fails
      return `
        Você é um assistente virtual para a plataforma RADE.

        Usuário atual: ${actor.name} (Perfil: ${isCoordinator ? 'Coordenador' : 'Estudante'})
        CPF do usuário: ${actor.cpf}

        REGRAS ABSOLUTAS:
        1. VOCÊ DEVE USAR AS FERRAMENTAS ANTES DE RESPONDER. NUNCA RESPONDA SEM USAR AS FERRAMENTAS PRIMEIRO.
        2. ESCOPO EXCLUSIVO RADE: Responda APENAS sobre assuntos acadêmicos da RADE. Para QUALQUER outra pergunta (futebol, clima, notícias, receitas, etc.), responda: "Desculpe, não posso te ajudar com essa questão. Posso ajudá-lo com informações sobre seus dados acadêmicos, atividades ou preceptores da plataforma RADE."

        Para QUALQUER pergunta sobre dados, informações pessoais ou acadêmicas, você DEVE chamar uma ferramenta ANTES de responder.
        NUNCA invente respostas - SEMPRE use as ferramentas disponíveis.

        ${this.getFormattingInstructions(environment)}
      `;
    }
  }
}