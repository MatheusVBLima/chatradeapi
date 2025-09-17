import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class PromptService {
  private readonly promptsPath = this.getPromptsPath();

  private getPromptsPath(): string {
    // In production, files are in dist folder, in development they're in src
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      return join(process.cwd(), 'dist', 'infrastructure', 'prompts');
    } else {
      return join(process.cwd(), 'src', 'infrastructure', 'prompts');
    }
  }

  getSystemPrompt(actor: User): string {
    const isCoordinator = actor.role === 'coordinator';
    const promptFile = isCoordinator ? 'coordinator.prompt.md' : 'student.prompt.md';
    
    try {
      const promptContent = readFileSync(join(this.promptsPath, promptFile), 'utf-8');

      console.log(`[PROMPT] Loading ${promptFile} from ${this.promptsPath}`);
      console.log(`[PROMPT] Content preview: ${promptContent.substring(0, 200)}...`);

      // Replace placeholders with actual user data
      const finalPrompt = promptContent
        .replace(/\{\{CPF\}\}/g, actor.cpf)
        .replace(/\{\{NAME\}\}/g, actor.name)
        .replace(/\{\{ROLE\}\}/g, isCoordinator ? 'Coordenador' : 'Estudante');

      console.log(`[PROMPT] Final prompt preview: ${finalPrompt.substring(0, 300)}...`);
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
      `;
    }
  }
}