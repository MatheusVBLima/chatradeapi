import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { VirtualAssistanceService } from '../services/virtual-assistance.service';
import { AIService } from '../services/ai.service';
import { ConfigService } from '@nestjs/config';
import { getVirtualAssistanceTools } from '../../application/use-cases/ai-tools';
// CoreTool removed in AI SDK v5 - using Record<string, any> for tools

export enum OpenChatFlowState {
  START = 'START',
  AWAITING_CPF = 'AWAITING_CPF',
  AWAITING_PHONE = 'AWAITING_PHONE', // Apenas para modo teste
  AUTHENTICATED = 'AUTHENTICATED',
  END = 'END',
}

export interface OpenChatState {
  currentState: OpenChatFlowState;
  data: {
    cpf?: string;
    phone?: string;
    userId?: string;
    role?: 'student' | 'coordinator';
    conversationHistory?: Array<{ role: string; content: string }>;
  };
}

export interface FlowResponse {
  response: string;
  nextState: OpenChatState;
}

@Injectable()
export class OpenChatFlow {
  private readonly SIMULATION_MODE: boolean;
  private currentSimulationMode: boolean;

  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('VirtualAssistanceService')
    private readonly virtualAssistanceService: VirtualAssistanceService,
    @Inject('AIService')
    private readonly aiService: AIService,
    private readonly configService: ConfigService,
  ) {
    this.SIMULATION_MODE =
      this.configService.get<string>('USE_API_DATA') !== 'true';
    this.currentSimulationMode = this.SIMULATION_MODE;
  }

  public async handle(
    message: string,
    state: OpenChatState | null,
    phone?: string,
    isTestMode?: boolean,
  ): Promise<FlowResponse> {
    // Sobrescrever SIMULATION_MODE se isTestMode for fornecido
    this.currentSimulationMode =
      isTestMode !== undefined ? isTestMode : this.SIMULATION_MODE;

    const currentState = state?.currentState || OpenChatFlowState.START;
    const stateData = state?.data || {};

    console.log(`[OPEN-CHAT] Estado: ${currentState}, Mensagem: ${message}`);

    switch (currentState) {
      case OpenChatFlowState.START:
        return this.handleStart();

      case OpenChatFlowState.AWAITING_CPF:
        return this.handleCpfInput(message, stateData);

      case OpenChatFlowState.AWAITING_PHONE:
        return this.handlePhoneInput(message, stateData);

      case OpenChatFlowState.AUTHENTICATED:
        return this.handleAuthenticatedChat(message, stateData, phone);

      default:
        return this.handleStart();
    }
  }

  private handleStart(): FlowResponse {
    return {
      response: `Bem-vindo ao Chat com IA RADE!

Para começar, por favor informe seu CPF (apenas números):`,
      nextState: {
        currentState: OpenChatFlowState.AWAITING_CPF,
        data: {},
      },
    };
  }

  private async handleCpfInput(
    cpf: string,
    stateData: any,
  ): Promise<FlowResponse> {
    const cleanCpf = cpf.replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      return {
        response:
          'CPF inválido. Por favor, digite um CPF válido com 11 dígitos:',
        nextState: {
          currentState: OpenChatFlowState.AWAITING_CPF,
          data: stateData,
        },
      };
    }

    // Buscar dados do usuário
    let usuario: any;
    let role: 'student' | 'coordinator';

    try {
      usuario = await this.virtualAssistanceService.getStudentInfo(cleanCpf);
      role = 'student';
    } catch (error) {
      try {
        usuario =
          await this.virtualAssistanceService.getCoordinatorInfo(cleanCpf);
        role = 'coordinator';
      } catch (coordError) {
        return {
          response: `CPF não encontrado no sistema. Por favor, verifique o CPF informado.

Digite seu CPF novamente ou digite "sair" para encerrar:`,
          nextState: {
            currentState: OpenChatFlowState.AWAITING_CPF,
            data: stateData,
          },
        };
      }
    }

    const nome = usuario.studentName || usuario.coordinatorName || 'Usuário';

    // Se está em modo teste, pede telefone. Senão, vai direto para autenticado
    if (this.currentSimulationMode) {
      return {
        response: `Olá, ${nome}!

Para continuar em modo de teste, por favor informe seu número de telefone com DDD (exemplo: 11999999999):`,
        nextState: {
          currentState: OpenChatFlowState.AWAITING_PHONE,
          data: {
            ...stateData,
            cpf: cleanCpf,
            userId: cleanCpf,
            role,
            userName: nome,
          },
        },
      };
    }

    // Produção - vai direto para autenticado
    return {
      response: `Olá, ${nome}! Você está autenticado.

Pode fazer suas perguntas sobre o sistema RADE!`,
      nextState: {
        currentState: OpenChatFlowState.AUTHENTICATED,
        data: {
          ...stateData,
          cpf: cleanCpf,
          userId: cleanCpf,
          role,
          userName: nome,
          conversationHistory: [],
        },
      },
    };
  }

  private async handlePhoneInput(
    phone: string,
    stateData: any,
  ): Promise<FlowResponse> {
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return {
        response:
          'Telefone inválido. Por favor, digite um telefone válido com DDD (10 ou 11 dígitos):',
        nextState: {
          currentState: OpenChatFlowState.AWAITING_PHONE,
          data: stateData,
        },
      };
    }

    return {
      response: `Ótimo, ${stateData.userName}! Você está autenticado em modo de teste.

Pode fazer suas perguntas sobre o sistema RADE!`,
      nextState: {
        currentState: OpenChatFlowState.AUTHENTICATED,
        data: {
          ...stateData,
          phone: cleanPhone,
          conversationHistory: [],
        },
      },
    };
  }

  private async handleAuthenticatedChat(
    message: string,
    stateData: any,
    phone?: string,
  ): Promise<FlowResponse> {
    try {
      // Buscar usuário autenticado
      const user = await this.userRepository.findByCpf(stateData.cpf);

      if (!user) {
        return {
          response:
            'Erro ao buscar seus dados. Por favor, inicie a conversa novamente.',
          nextState: { currentState: OpenChatFlowState.END, data: {} },
        };
      }

      // Obter tools baseado no role
      const availableTools = this.getToolsForRole(stateData.role);

      // Obter histórico de conversação
      const conversationHistory = stateData.conversationHistory || [];

      // Processar mensagem com IA (passando histórico)
      const aiResult = await this.aiService.processToolCall(
        user,
        message,
        availableTools,
        3, // maxToolDepth
        conversationHistory, // histórico de conversação
      );

      // ✅ CRÍTICO: Usar as mensagens completas retornadas (incluem tool results)
      // Não apenas user + assistant text, mas TODAS as mensagens (tool calls + results)
      const updatedHistory = aiResult.messages;

      return {
        response: aiResult.text,
        nextState: {
          currentState: OpenChatFlowState.AUTHENTICATED,
          data: {
            ...stateData,
            conversationHistory: updatedHistory, // ✅ Histórico completo com tool results
          },
        },
      };
    } catch (error) {
      console.error('[OPEN-CHAT] Erro ao processar chat:', error);
      return {
        response:
          'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        nextState: {
          currentState: OpenChatFlowState.AUTHENTICATED,
          data: stateData,
        },
      };
    }
  }

  private getToolsForRole(
    role: 'student' | 'coordinator',
  ): Record<string, any> {
    const tools = getVirtualAssistanceTools(this.configService);

    const studentTools = {
      getStudentsScheduledActivities: tools.getStudentsScheduledActivities,
      getStudentsProfessionals: tools.getStudentsProfessionals,
      getStudentInfo: tools.getStudentInfo,
    };

    const coordinatorTools = {
      getCoordinatorsOngoingActivities: tools.getCoordinatorsOngoingActivities,
      getCoordinatorsProfessionals: tools.getCoordinatorsProfessionals,
      getCoordinatorsStudents: tools.getCoordinatorsStudents,
      getCoordinatorInfo: tools.getCoordinatorInfo,
    };

    // Common tools available for everyone
    const commonTools = {
      findPersonByName: tools.findPersonByName,
    };

    // Add generateReport only if enabled
    if ((tools as any).generateReport) {
      (commonTools as any).generateReport = (tools as any).generateReport;
    }

    if (role === 'coordinator') {
      // Coordinators can also use student tools to look up specific students
      return { ...commonTools, ...studentTools, ...coordinatorTools };
    }

    return { ...commonTools, ...studentTools };
  }
}
