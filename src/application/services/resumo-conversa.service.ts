import { Injectable, Inject } from '@nestjs/common';
import { SessionCacheService } from './session-cache.service';
import { AIService } from '../../domain/services/ai.service';

export interface ResumoConversa {
  perfilUsuario: string;
  solicitacao: string;
  dificuldade: string;
  contextoAdicional: string;
  sugestaoAtendente: string;
  resumoCompleto: string;
}

@Injectable()
export class ResumoConversaService {
  constructor(
    private readonly sessionCache: SessionCacheService,
    @Inject('AIService') private readonly geminiService: AIService
  ) {}

  /**
   * Gera resumo com contexto específico da conversa
   */
  async gerarResumoComContexto(telefoneUsuario: string, contexto: any): Promise<string> {
    try {
      console.log('[RESUMO] Gerando resumo com contexto:', contexto.motivoTransferencia);

      // Se temos contexto específico, criar resumo mais detalhado
      if (contexto && contexto.historico) {
        const conversaTexto = contexto.historico.join('\n');

        // 4. Gerar resumo via IA (fallback para método simplificado se IA não funcionar)
        let resumoIA: string;
        try {
          const prompt = this.criarPromptResumoComContexto(conversaTexto, contexto);
          resumoIA = await this.geminiService.generateResponse(prompt, { name: 'Sistema', role: 'user' } as any);

          // Se retorna mensagem de descontinuado, usar método simplificado
          if (resumoIA.includes('descontinuado') || resumoIA.includes('deprecated')) {
            resumoIA = this.gerarResumoComContextoSemIA(contexto);
          }
        } catch (error) {
          console.log('[RESUMO] IA não disponível, usando resumo contextualizado simplificado');
          resumoIA = this.gerarResumoComContextoSemIA(contexto);
        }

        return this.formatarResumoFinal(resumoIA, telefoneUsuario);
      }

      // Fallback para método original se não há contexto
      return this.gerarResumoParaAtendente(telefoneUsuario);

    } catch (error) {
      console.error(`[RESUMO] Erro ao gerar resumo com contexto para ${telefoneUsuario}:`, error);
      return this.gerarResumoErro(telefoneUsuario);
    }
  }

  /**
   * Gera resumo inteligente da conversa para o atendente
   */
  async gerarResumoParaAtendente(telefoneUsuario: string): Promise<string> {
    try {
      // 1. Buscar histórico da conversa
      const session = this.sessionCache.getActiveSession(telefoneUsuario);

      if (!session || !session.conversationHistory.length) {
        return this.gerarResumoVazio(telefoneUsuario);
      }

      // 2. Montar contexto da conversa
      const conversaTexto = session.conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Bot'}: ${msg.content}`)
        .join('\n');

      // 3. Criar prompt especializado para resumo
      const prompt = this.criarPromptResumo(conversaTexto);

      // 4. Gerar resumo via IA (fallback para método simplificado se IA não funcionar)
      let resumoIA: string;
      try {
        resumoIA = await this.geminiService.generateResponse(prompt, { name: 'Sistema', role: 'user' } as any);

        // Se retorna mensagem de descontinuado, usar método simplificado
        if (resumoIA.includes('descontinuado') || resumoIA.includes('deprecated')) {
          resumoIA = this.gerarResumoSemIA(conversaTexto);
        }
      } catch (error) {
        console.log('[RESUMO] IA não disponível, usando resumo simplificado');
        resumoIA = this.gerarResumoSemIA(conversaTexto);
      }

      // 5. Formatar resumo final
      const resumoFormatado = this.formatarResumoFinal(resumoIA, telefoneUsuario);

      console.log(`[RESUMO] Resumo gerado para usuário ${telefoneUsuario}`);

      return resumoFormatado;

    } catch (error) {
      console.error(`[RESUMO] Erro ao gerar resumo para ${telefoneUsuario}:`, error);
      return this.gerarResumoErro(telefoneUsuario);
    }
  }

  /**
   * Cria prompt específico para gerar resumo profissional
   */
  private criarPromptResumo(conversaTexto: string): string {
    return `
Você é um assistente que cria resumos para atendentes humanos do sistema RADE (plataforma de estágios).

Analise esta conversa entre um usuário e o chatbot do RADE e crie um resumo profissional e objetivo para o atendente que vai assumir o caso.

CONVERSA:
${conversaTexto}

Crie um resumo seguindo EXATAMENTE este formato:

👤 PERFIL DO USUÁRIO:
- [Estudante/Coordenador]
- [Universidade/Curso se identificado]

🎯 SOLICITAÇÃO:
- [O que o usuário estava tentando fazer]

❌ DIFICULDADE ENFRENTADA:
- [Onde o chatbot não conseguiu ajudar ou usuário teve problema]

📋 CONTEXTO ADICIONAL:
- [Informações relevantes da conversa, CPF informado, etc.]

💡 SUGESTÃO PARA ATENDENTE:
- [Como o atendente pode ajudar melhor baseado na conversa]

INSTRUÇÕES IMPORTANTES:
- Seja conciso e objetivo
- Foque no que é útil para o atendente
- Se algo não foi mencionado na conversa, escreva "Não informado"
- Use linguagem profissional
- Destaque problemas específicos que o usuário enfrentou
`;
  }

  /**
   * Formata o resumo final com informações adicionais
   */
  private formatarResumoFinal(resumoIA: string, telefoneUsuario: string): string {
    // Se o resumo já é simples (sem seções detalhadas), retorna apenas ele
    if (resumoIA.includes('PRECISA DE AJUDA COM:')) {
      return resumoIA;
    }

    const timestamp = new Date().toLocaleString('pt-BR');

    return `📄 RESUMO DA CONVERSA

${resumoIA}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Telefone: ${telefoneUsuario}
⏰ Transferido em: ${timestamp}
🤖 Resumo gerado automaticamente`;
  }

  /**
   * Gera resumo quando não há histórico disponível
   */
  private gerarResumoVazio(telefoneUsuario: string): string {
    return `📄 RESUMO DA CONVERSA

👤 PERFIL DO USUÁRIO:
- Não informado

🎯 SOLICITAÇÃO:
- Usuário solicitou transferência para atendimento humano

❌ DIFICULDADE ENFRENTADA:
- Histórico de conversa não disponível

📋 CONTEXTO ADICIONAL:
- Conversa transferida sem histórico completo

💡 SUGESTÃO PARA ATENDENTE:
- Iniciar perguntando como pode ajudar
- Solicitar dados básicos (nome, CPF, universidade)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Telefone: ${telefoneUsuario}
⏰ Transferido em: ${new Date().toLocaleString('pt-BR')}
🤖 Resumo gerado automaticamente`;
  }

  /**
   * Gera resumo de erro quando IA falha
   */
  private gerarResumoErro(telefoneUsuario: string): string {
    return `📄 RESUMO DA CONVERSA

👤 PERFIL DO USUÁRIO:
- Erro ao processar histórico

🎯 SOLICITAÇÃO:
- Usuário solicitou ajuda adicional

❌ DIFICULDADE ENFRENTADA:
- Sistema não conseguiu processar a conversa anterior

📋 CONTEXTO ADICIONAL:
- Erro técnico na geração do resumo

💡 SUGESTÃO PARA ATENDENTE:
- Perguntar ao usuário qual era sua dúvida original
- Iniciar atendimento do zero se necessário

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Telefone: ${telefoneUsuario}
⏰ Transferido em: ${new Date().toLocaleString('pt-BR')}
⚠️ Resumo com erro técnico`;
  }

  /**
   * Gera resumo rápido sem IA (para casos de emergência)
   */
  async gerarResumoSimples(telefoneUsuario: string, dadosUsuario?: any): Promise<string> {
    const session = this.sessionCache.getActiveSession(telefoneUsuario);
    const ultimasMensagens = session?.conversationHistory.slice(-6) || [];

    const contexto = ultimasMensagens.length > 0
      ? ultimasMensagens.map(msg => `${msg.role === 'user' ? 'Usuário' : 'Bot'}: ${msg.content.substring(0, 100)}...`).join('\n')
      : 'Sem histórico disponível';

    return `📄 RESUMO DA CONVERSA

👤 PERFIL DO USUÁRIO:
- ${dadosUsuario?.studentName || dadosUsuario?.coordinatorName || 'Nome não informado'}
- ${dadosUsuario?.organizationsAndCourses?.[0]?.organizationName || 'Universidade não informada'}

🎯 SOLICITAÇÃO:
- Usuário solicitou transferência para atendimento humano

❌ DIFICULDADE ENFRENTADA:
- Precisou de ajuda adicional além do menu automatizado

📋 CONTEXTO ADICIONAL:
${contexto}

💡 SUGESTÃO PARA ATENDENTE:
- Perguntar como pode ajudar especificamente
- Verificar se é dúvida sobre funcionalidades do sistema

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Telefone: ${telefoneUsuario}
⏰ Transferido em: ${new Date().toLocaleString('pt-BR')}
🤖 Resumo simplificado`;
  }

  /**
   * Extrai palavras-chave da conversa
   */
  private extrairPalavrasChave(conversaTexto: string): string[] {
    const palavrasRelevantes = [
      'cadastro', 'agendamento', 'atividade', 'estágio', 'avaliação',
      'TCE', 'validação', 'QR code', 'login', 'senha', 'acesso',
      'nota', 'relatório', 'supervisor', 'preceptor', 'coordenador'
    ];

    const palavrasEncontradas: string[] = [];
    const textoLower = conversaTexto.toLowerCase();

    palavrasRelevantes.forEach(palavra => {
      if (textoLower.includes(palavra)) {
        palavrasEncontradas.push(palavra);
      }
    });

    return palavrasEncontradas;
  }

  /**
   * Detecta tipo de problema baseado na conversa
   */
  private detectarTipoProblema(conversaTexto: string): string {
    const textoLower = conversaTexto.toLowerCase();

    if (textoLower.includes('não consigo') || textoLower.includes('não encontro')) {
      return 'Dificuldade de navegação no sistema';
    }

    if (textoLower.includes('erro') || textoLower.includes('bug')) {
      return 'Possível erro técnico';
    }

    if (textoLower.includes('como') && textoLower.includes('fazer')) {
      return 'Dúvida sobre processo/procedimento';
    }

    if (textoLower.includes('não entendi') || textoLower.includes('confuso')) {
      return 'Necessita explicação mais detalhada';
    }

    return 'Solicitação geral de ajuda';
  }

  /**
   * Cria prompt específico para resumo com contexto
   */
  private criarPromptResumoComContexto(conversaTexto: string, contexto: any): string {
    return `
Você é um assistente que cria resumos para atendentes humanos do sistema RADE (plataforma de estágios).

Analise esta conversa entre um usuário e o chatbot do RADE e crie um resumo profissional e objetivo para o atendente que vai assumir o caso.

CONTEXTO DA CONVERSA:
- Tipo de usuário: ${contexto.tipoUsuario}
- CPF informado: ${contexto.cpfInformado}
- Motivo da transferência: ${contexto.motivoTransferencia}
${contexto.detalhes ? `- Detalhes: ${contexto.detalhes}` : ''}

CONVERSA:
${conversaTexto}

Crie um resumo seguindo EXATAMENTE este formato:

👤 PERFIL DO USUÁRIO:
- [Estudante/Coordenador]
- CPF: ${contexto.cpfInformado}

🎯 SOLICITAÇÃO:
- [O que o usuário estava tentando fazer baseado no contexto]

❌ DIFICULDADE ENFRENTADA:
- [Especificar que após assistir vídeos ou navegar no menu, ainda precisou de ajuda]

📋 CONTEXTO ADICIONAL:
- ${contexto.detalhes || 'Navegou pelo menu automatizado'}
- Telefone fornecido: ${contexto.telefoneInformado}

💡 SUGESTÃO PARA ATENDENTE:
- [Sugestão específica baseada no tipo de problema]

INSTRUÇÕES IMPORTANTES:
- Use as informações do contexto fornecido
- Seja específico sobre onde o usuário precisou de ajuda
- Foque no que é útil para o atendente continuar o atendimento
`;
  }

  /**
   * Gera resumo com contexto sem IA
   */
  private gerarResumoComContextoSemIA(contexto: any): string {
    const tipoUsuario = contexto.tipoUsuario === 'student' ? 'Estudante' :
                       contexto.tipoUsuario === 'coordinator' ? 'Coordenador' : 'Não informado';

    // Identificar qual opção do menu foi selecionada
    const opcaoMenu = this.identificarOpcaoMenu(contexto.motivoTransferencia);

    return `👤 ${tipoUsuario} - CPF: ${contexto.cpfInformado || 'Não informado'}

🎯 PRECISA DE AJUDA COM: ${opcaoMenu}`;
  }

  /**
   * Identifica qual opção do menu o usuário selecionou
   */
  private identificarOpcaoMenu(motivoTransferencia: string): string {
    if (!motivoTransferencia) return 'Opção não identificada';

    const motivoLower = motivoTransferencia.toLowerCase();

    if (motivoLower.includes('cadastro') || motivoLower.includes('menu 1')) {
      return 'Como fazer meu cadastro (Menu 1)';
    }
    if (motivoLower.includes('agendamento') || motivoLower.includes('menu 2')) {
      return 'Como fazer agendamento da atividade (Menu 2)';
    }
    if (motivoLower.includes('iniciar') || motivoLower.includes('menu 3')) {
      return 'Como iniciar minha atividade (Menu 3)';
    }
    if (motivoLower.includes('avaliar') || motivoLower.includes('menu 4')) {
      return 'Como avaliar minha atividade (Menu 4)';
    }
    if (motivoLower.includes('validar') || motivoLower.includes('menu 5')) {
      return 'Como validar minha atividade (Menu 5)';
    }
    if (motivoLower.includes('atendimento') || motivoLower.includes('menu 6')) {
      return 'Solicitar atendimento humano (Menu 6)';
    }

    return motivoTransferencia;
  }

  /**
   * Gera resumo sem IA (para casos quando IA não está disponível)
   */
  private gerarResumoSemIA(conversaTexto: string): string {
    const tipoProblema = this.detectarTipoProblema(conversaTexto);
    const palavrasChave = this.extrairPalavrasChave(conversaTexto);

    return `👤 PERFIL DO USUÁRIO:
- Usuário do sistema RADE
- Dados específicos serão verificados durante atendimento

🎯 SOLICITAÇÃO:
- ${tipoProblema}

❌ DIFICULDADE ENFRENTADA:
- Precisou de ajuda além do que o chatbot automatizado oferece

📋 CONTEXTO ADICIONAL:
- Palavras-chave identificadas: ${palavrasChave.length > 0 ? palavrasChave.join(', ') : 'Nenhuma específica'}

💡 SUGESTÃO PARA ATENDENTE:
- Verificar dados do usuário no sistema
- Perguntar especificamente sobre a dúvida
- Oferecer orientação passo a passo se necessário`;
  }
}