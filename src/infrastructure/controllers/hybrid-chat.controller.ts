import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessOpenChatMessageUseCase } from '../../application/use-cases/process-open-chat-message.use-case';
import { ClosedChatState, ChatFlowState } from '../../domain/flows/closed-chat.flow';
import axios from 'axios';

// Flow states for hybrid chat
enum HybridChatFlowState {
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
  AWAITING_AI_CPF = 'AWAITING_AI_CPF',
  AWAITING_AI_PHONE = 'AWAITING_AI_PHONE',
  AI_CHAT = 'AI_CHAT',
  END = 'END',
}

interface HybridChatState {
  currentState: HybridChatFlowState;
  data: {
    [key: string]: any;
    studentId?: string;
    userToken?: string;
    userType?: 'student' | 'coordinator';
  };
}

// DTOs
export class HybridChatRequestDto {
  message: string;
  state?: HybridChatState | null;
  channel: string;
}

export class HybridChatResponseDto {
  response: string;
  success: boolean;
  error?: string;
  nextState?: HybridChatState | null;
}

@Controller('chat')
export class HybridChatController {
  private readonly RADE_API_URL = process.env.RADE_API_BASE_URL || 'https://api.stg.radeapp.com';
  private readonly AI_CHAT_URL = process.env.AI_CHAT_URL || 'https://chatbot-api-32gp.onrender.com/chat/open';

  constructor(
    private readonly processOpenChatMessageUseCase: ProcessOpenChatMessageUseCase,
  ) {}

  @Post('hybrid')
  @HttpCode(HttpStatus.OK)
  async processHybridMessage(@Body() request: HybridChatRequestDto): Promise<HybridChatResponseDto> {
    try {
      const result = await this.handle(request.message, request.state || null);
      
      return {
        response: result.response,
        success: true,
        nextState: result.nextState,
      };
    } catch (error) {
      console.error('Error in hybrid chat:', error);
      return {
        response: 'Erro interno. Tente novamente mais tarde.',
        success: false,
        error: error.message,
      };
    }
  }

  private async handle(message: string, state: HybridChatState | null): Promise<{ response: string; nextState: HybridChatState | null }> {
    const currentState = state?.currentState || HybridChatFlowState.START;

    switch (currentState) {
      case HybridChatFlowState.START:
        return this.handleStart();

      case HybridChatFlowState.AWAITING_USER_TYPE:
        return this.handleUserTypeResponse(message, state!);

      case HybridChatFlowState.AWAITING_STUDENT_CPF:
        return this.handleStudentCpfResponse(message, state!);

      case HybridChatFlowState.AWAITING_COORDINATOR_CPF:
        return this.handleCoordinatorCpfResponse(message, state!);

      case HybridChatFlowState.AWAITING_STUDENT_MENU_CHOICE:
        return this.handleStudentMenuChoice(message, state!);

      case HybridChatFlowState.AWAITING_STUDENT_HELP_CHOICE:
        return this.handleStudentHelpChoice(message, state!);

      case HybridChatFlowState.AWAITING_COORDINATOR_MENU_CHOICE:
        return this.handleCoordinatorMenuChoice(message, state!);

      case HybridChatFlowState.AWAITING_COORDINATOR_HELP_CHOICE:
        return this.handleCoordinatorHelpChoice(message, state!);

      case HybridChatFlowState.AWAITING_NEW_USER_DETAILS:
        return this.handleNewUserDetails(message, state!);

      case HybridChatFlowState.AWAITING_AI_PHONE:
        return await this.handleAiPhoneResponse(message, state!);

      case HybridChatFlowState.AI_CHAT:
        return await this.handleAiChat(message, state!);

      default:
        return this.handleStart();
    }
  }

  private handleStart(): { response: string; nextState: HybridChatState } {
    const response = `Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1 - Sou Estudante
2 - Sou Coordenador  
3 - Ainda não sou usuário`;

    return {
      response,
      nextState: {
        currentState: HybridChatFlowState.AWAITING_USER_TYPE,
        data: {},
      },
    };
  }

  private handleUserTypeResponse(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    const choice = message.trim();

    if (choice === '1') {
      return {
        response: 'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: HybridChatFlowState.AWAITING_STUDENT_CPF,
          data: state.data,
        },
      };
    }

    if (choice === '2') {
      return {
        response: 'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: HybridChatFlowState.AWAITING_COORDINATOR_CPF,
          data: state.data,
        },
      };
    }

    if (choice === '3') {
      return {
        response: 'Ok. Para realizar seu cadastro inicial, por favor, me diga seu nome completo, CPF, instituição, curso e período, tudo em uma única mensagem.',
        nextState: {
          currentState: HybridChatFlowState.AWAITING_NEW_USER_DETAILS,
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

  private async handleStudentCpfResponse(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    const cpf = message.trim();
    
    // For now, just show menu (in real app would validate via API)
    return this.showStudentMenu({ ...state.data, studentCpf: cpf, cpf: cpf });
  }

  private async handleCoordinatorCpfResponse(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    const cpf = message.trim();
    
    // For now, just show menu (in real app would validate via API)
    return this.showCoordinatorMenu({ ...state.data, coordinatorCpf: cpf, cpf: cpf });
  }

  private handleStudentMenuChoice(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    const choice = message.trim();
    const videoLinks = {
      '1': 'https://www.youtube.com/watch?v=video1_cadastro',
      '2': 'https://www.youtube.com/watch?v=video2_agendamento',
      '3': 'https://www.youtube.com/watch?v=video3_iniciar_finalizar',
      '4': 'https://www.youtube.com/watch?v=video4_avaliacao',
      '5': 'https://www.youtube.com/watch?v=video5_justificar',
      '6': 'https://www.youtube.com/watch?v=video6_tce',
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
          currentState: HybridChatFlowState.AWAITING_STUDENT_HELP_CHOICE,
          data: state.data,
        },
      };
    }

    if (choice === '7') {
      // AI option for student - usar CPF já informado
      return {
        response: 'Agora, informe seu número de telefone (com DDD):\n\nOu digite "voltar" para retornar ao menu anterior.',
        nextState: {
          currentState: HybridChatFlowState.AWAITING_AI_PHONE,
          data: { ...state.data, userType: 'student' },
        },
      };
    }

    if (choice === '8') {
      // Voltar ao menu inicial
      return this.handleStart();
    }

    if (choice === '9') {
      return {
        response: 'Ok, estou encerrando nosso atendimento. Se precisar de algo mais, basta me chamar!',
        nextState: { currentState: HybridChatFlowState.END, data: {} },
      };
    }

    return {
      response: 'Opção inválida. Por favor, escolha um número do menu.',
      nextState: state,
    };
  }

  private handleStudentHelpChoice(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    const choice = message.trim();
    if (choice === '1') {
      return this.showStudentMenu(state.data);
    }

    if (choice === '2') {
      return {
        response: 'Entendido. Estou transferindo você para um de nossos atendentes para te ajudar melhor.',
        nextState: { currentState: HybridChatFlowState.END, data: {} },
      };
    }

    if (choice === '3') {
      return this.showStudentMenu(state.data);
    }

    return {
      response: 'Resposta inválida. Por favor, escolha uma das opções (1, 2 ou 3).',
      nextState: state,
    };
  }

  private handleCoordinatorMenuChoice(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    const choice = message.trim();
    const videoLinks = {
      '1': 'https://www.youtube.com/watch?v=9AQrYArZ-5k',
      '2': 'https://www.youtube.com/watch?v=RkjrtSsEDP8',
      '3': 'https://www.youtube.com/watch?v=TsXVDRszDnY',
      '4': 'https://www.youtube.com/watch?v=bT1Qnk1B8Oo',
    };

    if (videoLinks[choice]) {
      const response = `Certo! Aqui está o vídeo com as instruções: ${videoLinks[choice]}

O vídeo foi útil ou você precisa de mais alguma ajuda?
1 - Sim, foi suficiente
2 - Não, preciso de mais ajuda
3 - Voltar ao menu anterior`;
      return {
        response,
        nextState: {
          currentState: HybridChatFlowState.AWAITING_COORDINATOR_HELP_CHOICE,
          data: state.data,
        },
      };
    }

    if (choice === '5') {
      // AI option for coordinator - usar CPF já informado
      return {
        response: 'Agora, informe seu número de telefone (com DDD):\n\nOu digite "voltar" para retornar ao menu anterior.',
        nextState: {
          currentState: HybridChatFlowState.AWAITING_AI_PHONE,
          data: { ...state.data, userType: 'coordinator' },
        },
      };
    }

    if (choice === '6') {
      // Voltar ao menu inicial
      return this.handleStart();
    }

    if (choice === '7') {
      return {
        response: 'Compreendido. Estou encerrando nosso atendimento.',
        nextState: { currentState: HybridChatFlowState.END, data: {} },
      };
    }

    return {
      response: 'Opção inválida. Por favor, escolha um número do menu de coordenador.',
      nextState: state,
    };
  }

  private handleCoordinatorHelpChoice(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    const choice = message.trim();
    if (choice === '1') {
      return this.showCoordinatorMenu(state.data);
    }

    if (choice === '2') {
      return {
        response: 'Compreendido. Estou te encaminhando para um de nossos especialistas.',
        nextState: { currentState: HybridChatFlowState.END, data: {} },
      };
    }

    if (choice === '3') {
      return this.showCoordinatorMenu(state.data);
    }

    return {
      response: 'Resposta inválida. Por favor, escolha uma das opções (1, 2 ou 3).',
      nextState: state,
    };
  }

  private handleNewUserDetails(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    return {
      response: 'Obrigado! Seus dados foram recebidos e em breve entraremos em contato para finalizar seu cadastro. O atendimento será encerrado.',
      nextState: {
        currentState: HybridChatFlowState.END,
        data: {},
      },
    };
  }


  private async handleAiPhoneResponse(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    const phone = message.trim();
    
    if (phone.toLowerCase() === 'sair') {
      return {
        response: 'Atendimento encerrado. Obrigado!',
        nextState: { currentState: HybridChatFlowState.END, data: {} },
      };
    }
    
    if (phone.toLowerCase() === 'voltar') {
      const userType = state.data.userType;
      if (userType === 'student') {
        return this.showStudentMenu(state.data);
      } else if (userType === 'coordinator') {
        return this.showCoordinatorMenu(state.data);
      }
    }
    
    const userType = state.data.userType;
    const cpf = state.data.studentCpf || state.data.coordinatorCpf || state.data.userCpf;

    if (!userType || !cpf) {
      return {
        response: 'Erro interno: dados de usuário não encontrados.',
        nextState: state,
      };
    }

    const authResult = await this.authenticateUser(cpf, phone, userType);

    if (!authResult.token) {
      return {
        response: `CPF ou telefone não conferem. Verifique os dados e tente novamente.

Digite "voltar" para retornar ao menu anterior ou "sair" para encerrar.`,
        nextState: state,
      };
    }

    const welcomeMessage = `Autenticado com sucesso! Como posso ajudá-lo?\n\nDigite "voltar" para retornar ao menu principal ou "sair" para encerrar.`;

    return {
      response: welcomeMessage,
      nextState: {
        currentState: HybridChatFlowState.AI_CHAT,
        data: { ...state.data, userToken: authResult.token, userCpf: cpf },
      },
    };
  }

  private async handleAiChat(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    if (message.toLowerCase().trim() === 'sair') {
      return {
        response: 'Atendimento encerrado. Obrigado!',
        nextState: { currentState: HybridChatFlowState.END, data: {} },
      };
    }

    if (message.toLowerCase().trim() === 'voltar') {
      const userType = state.data.userType;
      if (userType === 'student') {
        return this.showStudentMenu(state.data);
      } else if (userType === 'coordinator') {
        return this.showCoordinatorMenu(state.data);
      }
      return this.handleStart();
    }

    try {
      // Use the existing AI chat functionality
      const result = await this.processOpenChatMessageUseCase.execute({
        message: message,
        userId: state.data.userCpf,
        channel: 'web',
      });

      // If the user is not found in the API, but was authenticated in hybrid flow,
      // provide a helpful response instead of the generic error
      if (!result.success && result.error === 'Actor not found') {
        return {
          response: `Olá! Estou tendo dificuldades para acessar seus dados completos no momento. 
          
Como posso ajudá-lo? Você pode me fazer perguntas sobre:
- Cadastro e atividades no sistema
- Processos de estágio
- Dúvidas gerais sobre o RADE

Digite "voltar" para retornar ao menu principal ou "sair" para encerrar.`,
          nextState: state,
        };
      }

      let fullResponse = result.response;
      
      // Detect and highlight download links
      if (result.response.includes('http://localhost:3001/reports/') || result.response.includes('https://api.stg.radeapp.com/reports/')) {
        fullResponse += `\n\n📎 Link para download gerado. Copie o link acima e cole no navegador.`;
      }

      return {
        response: fullResponse,
        nextState: state,
      };
    } catch (error) {
      return {
        response: `Erro ao contatar o serviço. Tente novamente.`,
        nextState: state,
      };
    }
  }

  private async authenticateUser(cpf: string, phone: string, userType: string): Promise<{ token: string | null; userData: any }> {
    try {
      const endpoint = userType === 'student' ? 'students' : 'coordinators';
      const radeToken = process.env.RADE_API_TOKEN || 'JQiFrDkkM5eNKtLxwNKzZoga0xkeRDAZ';
      
      const response = await axios.get(
        `${this.RADE_API_URL}/virtual-assistance/${endpoint}/${cpf}`,
        {
          headers: {
            'Authorization': radeToken,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data) {
        const userPhone = response.data.studentPhone || response.data.coordinatorPhone || '';
        // Remove formatting and compare
        const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
        
        if (normalizePhone(userPhone) === normalizePhone(phone)) {
          return {
            token: `${userType}_authenticated`,
            userData: response.data
          };
        } else {
          return { token: null, userData: null };
        }
      }
      return { token: null, userData: null };
    } catch (error) {
      return { token: null, userData: null };
    }
  }

  private showStudentMenu(data: any): { response: string; nextState: HybridChatState } {
    return {
      response: `Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Conversar com Atendente Virtual
8 - Voltar ao menu inicial
9 - Encerrar atendimento`,
      nextState: {
        currentState: HybridChatFlowState.AWAITING_STUDENT_MENU_CHOICE,
        data,
      },
    };
  }

  private showCoordinatorMenu(data: any): { response: string; nextState: HybridChatState } {
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
        currentState: HybridChatFlowState.AWAITING_COORDINATOR_MENU_CHOICE,
        data,
      },
    };
  }
}