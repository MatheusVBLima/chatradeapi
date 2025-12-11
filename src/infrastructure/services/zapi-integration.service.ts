import { Injectable, Logger } from '@nestjs/common';
import { ZapiWebhookMessage, WhatsAppUserSession, ZapiChatState } from '../../domain/types/zapi.types';
import { ZapiService } from './zapi.service';
import { ApiClientService } from './api-client.service';
import { SessionCacheService } from '../../application/services/session-cache.service';

// Import your existing chat flow
// We'll use the same flow logic from test-hybrid-staging.ts
enum ChatFlowState {
  START = 'START',
  AWAITING_USER_TYPE = 'AWAITING_USER_TYPE',
  AWAITING_STUDENT_CPF = 'AWAITING_STUDENT_CPF',
  AWAITING_COORDINATOR_CPF = 'AWAITING_COORDINATOR_CPF',
  STUDENT_MENU = 'STUDENT_MENU',
  AWAITING_STUDENT_MENU_CHOICE = 'AWAITING_STUDENT_MENU_CHOICE',
  AWAITING_STUDENT_HELP_CHOICE = 'AWAITING_STUDENT_HELP_CHOICE',
  COORDINATOR_MENU = 'COORDINATOR_MENU',
  AWAITING_COORDINATOR_MENU_CHOICE = 'AWAITING_COORDINATOR_MENU_CHOICE',
  AWAITING_COORDINATOR_HELP_CHOICE = 'AWAITING_COORDINATOR_HELP_CHOICE',
  AWAITING_NEW_USER_DETAILS = 'AWAITING_NEW_USER_DETAILS',
  // AI states with phone auth
  AWAITING_AI_USER_TYPE = 'AWAITING_AI_USER_TYPE',
  AWAITING_AI_CPF = 'AWAITING_AI_CPF',
  AWAITING_AI_PHONE = 'AWAITING_AI_PHONE',
  AI_CHAT = 'AI_CHAT',
  END = 'END',
}

interface ChatState {
  currentState: ChatFlowState;
  data: {
    [key: string]: any;
    studentId?: string;
    userToken?: string;
    userType?: 'student' | 'coordinator';
    userCpf?: string;
  };
}

@Injectable()
export class ZapiIntegrationService {
  private readonly logger = new Logger(ZapiIntegrationService.name);
  private readonly userSessions = new Map<string, WhatsAppUserSession>();
  private readonly chatStates = new Map<string, ChatState>();

  constructor(
    private readonly zapiService: ZapiService,
    private readonly sessionCache: SessionCacheService,
    private readonly apiClientService: ApiClientService
  ) {
    this.logger.log('Z-API Integration Service initialized');
    
    // Setup automatic cleanup of expired sessions every 10 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Verifica se a instância é de produção baseada no instanceId
   */
  private isProductionInstance(instanceId: string): boolean {
    const productionInstanceId = process.env.ZAPI_INSTANCE_ID || '3CF34E4D1D8BE0C91D482A268ACD4084';
    return instanceId === productionInstanceId;
  }

  /**
   * Envia mensagem para a instância específica
   */
  private async sendMessageToInstance(instanceId: string, phone: string, message: string): Promise<void> {
    if (this.isProductionInstance(instanceId)) {
      // Usar configuração padrão para produção
      await this.zapiService.sendWhatsAppMessage(phone, message);
    } else {
      // Para instância de teste, usar configuração específica
      await this.sendMessageToTestInstance(instanceId, phone, message);
    }
  }

  /**
   * Converte markdown para formatação nativa do WhatsApp
   */
  private formatForWhatsApp(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '*$1*')  // **negrito** → *negrito*
      .replace(/~~(.+?)~~/g, '~$1~');     // ~~tachado~~ → ~tachado~
  }

  /**
   * Envia mensagem para instância de teste
   */
  private async sendMessageToTestInstance(instanceId: string, phone: string, message: string): Promise<void> {
    const testToken = process.env.ZAPI_TEST_TOKEN;
    const testClientToken = process.env.ZAPI_TEST_CLIENT_TOKEN;
    const baseUrl = process.env.ZAPI_BASE_URL || 'https://api.z-api.io';

    // Converter markdown para formato WhatsApp
    const formattedMessage = this.formatForWhatsApp(message);

    if (!testToken) {
      this.logger.warn(`Token de teste não configurado para instância ${instanceId}. Usando configuração padrão.`);
      await this.zapiService.sendWhatsAppMessage(phone, message);
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${testToken}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': testClientToken || '',
        },
        body: JSON.stringify({
          phone,
          message: formattedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.log(`Mensagem enviada para instância de teste ${instanceId}: ${phone}`);
    } catch (error) {
      this.logger.error(`Erro enviando mensagem para instância de teste ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * Process incoming WhatsApp message
   */
  async processIncomingMessage(webhookData: ZapiWebhookMessage): Promise<void> {
    const phone = webhookData.phone;
    const message = webhookData.text?.message || '';
    const instanceId = webhookData.instanceId;

    this.logger.log(`Mensagem de ${phone} (instância: ${instanceId}): ${message}`);

    // Verificar se é instância de produção ou teste
    const isProductionInstance = this.isProductionInstance(instanceId);
    
    if (!isProductionInstance) {
      this.logger.log(`🧪 INSTÂNCIA DE TESTE detectada: ${instanceId}`);
      // Para instância de teste, adicionar prefixo nas respostas
    }

    try {
      // Verificar comandos especiais
      if (this.isEndCommand(message)) {
        await this.handleEndSession(phone, instanceId);
        return;
      }

      if (this.isStartCommand(message)) {
        await this.handleStartNewSession(phone, instanceId);
        return;
      }

      // Obter ou criar sessão
      const session = this.sessionCache.getOrCreateSession(phone);
      
      // Adicionar mensagem do usuário ao histórico
      this.sessionCache.addMessage(session.sessionId, 'user', message);
      
      // Processar mensagem com contexto da sessão
      const { response, nextState } = await this.processChatFlow(
        message, 
        {
          currentState: session.currentState as ChatFlowState,
          data: session.contextData
        }
      );
      
      // Atualizar estado da sessão
      this.sessionCache.updateSession(session.sessionId, {
        currentState: nextState?.currentState || session.currentState,
        contextData: nextState?.data || session.contextData
      });
      
      // Adicionar prefixo para instância de teste
      let finalResponse = response;
      if (!isProductionInstance) {
        finalResponse = `🧪 [TESTE] ${response}`;
      }
      
      // Adicionar resposta ao histórico
      this.sessionCache.addMessage(session.sessionId, 'assistant', finalResponse);
      
      // Enviar resposta via WhatsApp usando a configuração correta da instância
      await this.sendMessageToInstance(instanceId, phone, finalResponse);
      
      // Se chegou ao fim do fluxo, finalizar sessão
      if (nextState?.currentState === 'END') {
        setTimeout(() => {
          this.sessionCache.endSession(phone);
        }, 5000); // Aguarda 5 segundos antes de limpar
      }
      
    } catch (error) {
      this.logger.error(`Erro processando mensagem de ${phone}:`, error);
      
      await this.zapiService.sendWhatsAppMessage(
        phone, 
        '❌ Desculpe, ocorreu um erro. Digite "iniciar" para começar uma nova conversa.'
      );
    }
  }

  /**
   * Process chat flow - same logic as LocalChatFlow from test-hybrid-staging.ts
   */
  private async processChatFlow(
    message: string, 
    state: ChatState | null
  ): Promise<{ response: string; nextState: ChatState | null }> {
    const currentState = state?.currentState || ChatFlowState.START;

    switch (currentState) {
      case ChatFlowState.START:
        return this.handleStart();

      case ChatFlowState.AWAITING_USER_TYPE:
        return this.handleUserTypeResponse(message, state!);

      case ChatFlowState.AWAITING_STUDENT_CPF:
        return await this.handleStudentCpfResponse(message, state!);

      case ChatFlowState.AWAITING_COORDINATOR_CPF:
        return await this.handleCoordinatorCpfResponse(message, state!);

      case ChatFlowState.AWAITING_STUDENT_MENU_CHOICE:
        return this.handleStudentMenuChoice(message, state!);

      case ChatFlowState.AWAITING_STUDENT_HELP_CHOICE:
        return this.handleStudentHelpChoice(message, state!);

      case ChatFlowState.AWAITING_COORDINATOR_MENU_CHOICE:
        return this.handleCoordinatorMenuChoice(message, state!);

      case ChatFlowState.AWAITING_COORDINATOR_HELP_CHOICE:
        return this.handleCoordinatorHelpChoice(message, state!);

      case ChatFlowState.AWAITING_NEW_USER_DETAILS:
        return this.handleNewUserDetails(message, state!);

      case ChatFlowState.AWAITING_AI_PHONE:
        return await this.handleAiPhoneResponse(message, state!);

      case ChatFlowState.AI_CHAT:
        return await this.handleAiChat(message, state!);

      default:
        return this.handleStart();
    }
  }

  // Chat flow handlers - same logic as test-hybrid-staging.ts
  private handleStart(): { response: string; nextState: ChatState } {
    const response = `🤖 Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1️⃣ Sou Estudante
2️⃣ Sou Coordenador  
3️⃣ Ainda não sou usuário`;

    return {
      response,
      nextState: {
        currentState: ChatFlowState.AWAITING_USER_TYPE,
        data: {},
      },
    };
  }

  private handleUserTypeResponse(message: string, state: ChatState): { response: string; nextState: ChatState } {
    const choice = message.trim();

    if (choice === '1') {
      return {
        response: 'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: ChatFlowState.AWAITING_STUDENT_CPF,
          data: state.data,
        },
      };
    }

    if (choice === '2') {
      return {
        response: 'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: ChatFlowState.AWAITING_COORDINATOR_CPF,
          data: state.data,
        },
      };
    }

    if (choice === '3') {
      return {
        response: 'Ok. Para realizar seu cadastro inicial, por favor, me diga seu nome completo, CPF, instituição, curso e período, tudo em uma única mensagem.',
        nextState: {
          currentState: ChatFlowState.AWAITING_NEW_USER_DETAILS,
          data: state.data,
        },
      };
    }

    // Invalid choice
    const response = `Desculpe, não entendi sua resposta. Por favor, escolha uma das opções (1, 2 ou 3):
1 - Sou Estudante
2 - Sou Coordenador
3 - Ainda não sou usuário`;
    return {
      response,
      nextState: state,
    };
  }

  private async handleStudentCpfResponse(message: string, state: ChatState): Promise<{ response: string; nextState: ChatState }> {
    const cpf = message.trim();
    
    // For now, just show menu (in real app would validate via API)
    return this.showStudentMenu({ ...state.data, studentCpf: cpf });
  }

  private async handleCoordinatorCpfResponse(message: string, state: ChatState): Promise<{ response: string; nextState: ChatState }> {
    const cpf = message.trim();
    
    // For now, just show menu (in real app would validate via API)
    return this.showCoordinatorMenu({ ...state.data, coordinatorCpf: cpf });
  }

  private handleStudentMenuChoice(message: string, state: ChatState): { response: string; nextState: ChatState } {
    const choice = message.trim();
    
    // Video links mapping
    const videoLinks = {
      '1': 'https://rade.b-cdn.net/bot/videos/cadastro.mp4',
      '2': 'https://rade.b-cdn.net/bot/videos/agendamento-atividades.mp4',
      '3': 'https://rade.b-cdn.net/bot/videos/iniciar-finalizar-atividade.mp4',
      '4': 'https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4',
      '5': 'https://rade.b-cdn.net/bot/videos/justificar-atividade-perdida.mp4',
      '6': 'https://rade.b-cdn.net/bot/videos/preencher-tce.mp4',
    };

    if (videoLinks[choice]) {
      const response = `Claro! Aqui está o vídeo sobre isso: ${videoLinks[choice]}

O vídeo foi suficiente ou posso ajudar com algo mais?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior`;
      return {
        response,
        nextState: {
          currentState: ChatFlowState.AWAITING_STUDENT_HELP_CHOICE,
          data: state.data,
        },
      };
    }

    if (choice === '7') {
      // AI option for student - when implemented
      return {
        response: 'Funcionalidade de atendente virtual será implementada em breve. Por enquanto, escolha uma das outras opções.',
        nextState: state,
      };
    }

    if (choice === '8') {
      // Voltar ao menu inicial
      return this.handleStart();
    }

    if (choice === '9') {
      return {
        response: 'Ok, estou encerrando nosso atendimento. Se precisar de algo mais, basta me chamar!',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }

    return {
      response: 'Opção inválida. Por favor, escolha um número do menu.',
      nextState: state,
    };
  }

  // Additional handlers would go here...
  private handleStudentHelpChoice(message: string, state: ChatState): { response: string; nextState: ChatState } {
    const choice = message.trim();
    if (choice === '1' || choice === '3') {
      return this.showStudentMenu(state.data);
    }

    if (choice === '2') {
      return {
        response: 'Entendido. Estou transferindo você para um de nossos atendentes para te ajudar melhor.',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }

    return {
      response: 'Resposta inválida. Por favor, escolha uma das opções (1, 2 ou 3).',
      nextState: state,
    };
  }

  private handleCoordinatorMenuChoice(message: string, state: ChatState): { response: string; nextState: ChatState } {
    // Similar logic to student menu
    return {
      response: 'Menu de coordenador será implementado em breve.',
      nextState: { currentState: ChatFlowState.END, data: {} },
    };
  }

  private handleCoordinatorHelpChoice(message: string, state: ChatState): { response: string; nextState: ChatState } {
    return {
      response: 'Ajuda de coordenador será implementada em breve.',
      nextState: { currentState: ChatFlowState.END, data: {} },
    };
  }

  private handleNewUserDetails(message: string, state: ChatState): { response: string; nextState: ChatState } {
    return {
      response: 'Obrigado! Seus dados foram recebidos e em breve entraremos em contato para finalizar seu cadastro. O atendimento será encerrado.',
      nextState: {
        currentState: ChatFlowState.END,
        data: {},
      },
    };
  }

  private async handleAiPhoneResponse(message: string, state: ChatState): Promise<{ response: string; nextState: ChatState }> {
    return {
      response: 'Funcionalidade AI será implementada em breve.',
      nextState: { currentState: ChatFlowState.END, data: {} },
    };
  }

  private async handleAiChat(message: string, state: ChatState): Promise<{ response: string; nextState: ChatState }> {
    return {
      response: 'Chat AI será implementado em breve.',
      nextState: { currentState: ChatFlowState.END, data: {} },
    };
  }

  private showStudentMenu(data: any): { response: string; nextState: ChatState } {
    return {
      response: `🤖 Aqui estão as opções que posso te ajudar:

📚 1 - Como fazer meu cadastro
📅 2 - Como agendar minhas atividades  
▶️ 3 - Como iniciar e finalizar atividade
⭐ 4 - Como fazer uma avaliação
❌ 5 - Como justificar atividade perdida
📄 6 - Como preencher meu TCE
💬 7 - Conversar com Atendente Virtual
🔙 8 - Voltar ao menu inicial
🚪 9 - Encerrar atendimento`,
      nextState: {
        currentState: ChatFlowState.AWAITING_STUDENT_MENU_CHOICE,
        data,
      },
    };
  }

  private showCoordinatorMenu(data: any): { response: string; nextState: ChatState } {
    return {
      response: `Bem-vindo, coordenador! Como posso ajudar hoje?
1 - Como validar atividades
2 - Como realizar avaliação
3 - Como agendar retroativo
4 - Como gerar QR code
5 - Conversar com Atendente Virtual
6 - Voltar ao menu inicial
7 - Encerrar atendimento`,
      nextState: {
        currentState: ChatFlowState.AWAITING_COORDINATOR_MENU_CHOICE,
        data,
      },
    };
  }

  // Adicionar métodos auxiliares
  private isEndCommand(message: string): boolean {
    const endCommands = ['sair', 'finalizar', 'encerrar', 'fim', 'tchau', '9'];
    return endCommands.includes(message.toLowerCase().trim());
  }

  private isStartCommand(message: string): boolean {
    const startCommands = ['oi', 'olá', 'início', 'iniciar', 'começar', 'start', 'menu'];
    return startCommands.includes(message.toLowerCase().trim());
  }

  private async handleEndSession(phone: string, instanceId?: string): Promise<void> {
    this.sessionCache.endSession(phone);
    
    await this.zapiService.sendWhatsAppMessage(
      phone,
      '👋 Atendimento finalizado com sucesso!\n\n' +
      'Obrigado por usar nosso serviço. ' +
      'Para iniciar uma nova conversa, envie "oi" a qualquer momento.'
    );
    
    this.logger.log(`Sessão finalizada para ${phone}`);
  }

  private async handleStartNewSession(phone: string, instanceId?: string): Promise<void> {
    // Criar nova sessão (finaliza a anterior se existir)
    const session = this.sessionCache.createNewSession(phone);
    
    // Processar como início do fluxo
    const { response, nextState } = await this.processChatFlow('', null);
    
    // Atualizar estado inicial
    this.sessionCache.updateSession(session.sessionId, {
      currentState: nextState?.currentState || 'START',
      contextData: nextState?.data || {}
    });
    
    // Enviar mensagem de boas-vindas
    await this.zapiService.sendWhatsAppMessage(phone, response);
    
    this.logger.log(`Nova sessão iniciada para ${phone}: ${session.sessionId}`);
  }

  /**
   * User session management
   */
  private getOrCreateUserSession(phone: string): WhatsAppUserSession {
    let session = this.userSessions.get(phone);
    
    if (!session) {
      session = {
        phone,
        isAuthenticated: false,
        currentState: ChatFlowState.START,
        sessionData: {},
        lastActivity: new Date(),
      };
      this.userSessions.set(phone, session);
      this.logger.log(`Created new session for ${phone}`);
    }
    
    return session;
  }

  private cleanupUserSession(phone: string): void {
    this.userSessions.delete(phone);
    this.chatStates.delete(phone);
    this.logger.log(`Cleaned up session for ${phone}`);
  }

  /**
   * Configuration status for health checks
   */
  getConfigurationStatus() {
    return {
      zapiConfigured: this.zapiService.isConfigured(),
      activeSessions: this.userSessions.size,
      activeChatStates: this.chatStates.size,
    };
  }

  /**
   * Clean up expired sessions (call this periodically)
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [phone, session] of this.userSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        this.cleanupUserSession(phone);
        this.logger.log(`Cleaned up expired session for ${phone}`);
      }
    }
  }
}