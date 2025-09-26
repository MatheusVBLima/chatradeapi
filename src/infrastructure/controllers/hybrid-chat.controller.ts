import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessOpenChatMessageUseCase } from '../../application/use-cases/process-open-chat-message.use-case';
import { ClosedChatState, ChatFlowState } from '../../domain/flows/closed-chat.flow';
import { SimulationService } from '../../application/services/simulation.service';
import { ResumoConversaService } from '../../application/services/resumo-conversa.service';
import { ApiVirtualAssistanceService } from '../services/api-virtual-assistance.service';
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
  // Simulation states
  AWAITING_SIMULATION_PHONE = 'AWAITING_SIMULATION_PHONE',
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
  private readonly SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';

  constructor(
    private readonly processOpenChatMessageUseCase: ProcessOpenChatMessageUseCase,
    private readonly simulationService: SimulationService,
    private readonly resumoConversaService: ResumoConversaService,
    private readonly apiVirtualAssistanceService: ApiVirtualAssistanceService,
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

      case HybridChatFlowState.AWAITING_SIMULATION_PHONE:
        return await this.handleSimulationPhoneResponse(message, state!);

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
          currentState: HybridChatFlowState.AWAITING_STUDENT_HELP_CHOICE,
          data: state.data,
        },
      };
    }

    if (choice === '7') {
      // AI option for student - PRODUÇÃO: ir direto para AI_CHAT sem pedir telefone
      const cpf = state.data.studentCpf || state.data.cpf;
      const welcomeMessage = `Olá! Como posso ajudá-lo?\n\nDigite "voltar" para retornar ao menu principal ou "sair" para encerrar.`;

      return {
        response: welcomeMessage,
        nextState: {
          currentState: HybridChatFlowState.AI_CHAT,
          data: { ...state.data, userType: 'student', userCpf: cpf, userToken: 'prod_student_authenticated' },
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

  private async handleStudentHelpChoice(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    const choice = message.trim();
    if (choice === '1' || choice === '3') {
      return this.showStudentMenu(state.data);
    }

    if (choice === '2') {
      // PRODUÇÃO: Transferir para atendimento direto (Z-API obtém telefone automaticamente)
      const telefoneZapi = state.data.userPhone || 'auto_detected'; // Z-API detecta automaticamente
      return await this.processarTransferencia(telefoneZapi, state.data);
    }

    return {
      response: 'Resposta inválida. Por favor, escolha uma das opções (1, 2 ou 3).',
      nextState: state,
    };
  }

  private handleCoordinatorMenuChoice(message: string, state: HybridChatState): { response: string; nextState: HybridChatState } {
    const choice = message.trim();
    const videoLinks = {
      '1': 'https://rade.b-cdn.net/bot/videos/validar-rejeitar-atividades.mp4',
      '2': 'https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4',
      '3': 'https://rade.b-cdn.net/bot/videos/rade-profissional-funcionalidades.mp4',
      '4': 'https://rade.b-cdn.net/bot/videos/gerar-qr-code.mp4',
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
      // AI option for coordinator - PRODUÇÃO: ir direto para AI_CHAT sem pedir telefone
      const cpf = state.data.coordinatorCpf || state.data.cpf;
      const welcomeMessage = `Olá! Como posso ajudá-lo?\n\nDigite "voltar" para retornar ao menu principal ou "sair" para encerrar.`;

      return {
        response: welcomeMessage,
        nextState: {
          currentState: HybridChatFlowState.AI_CHAT,
          data: { ...state.data, userType: 'coordinator', userCpf: cpf, userToken: 'prod_coordinator_authenticated' },
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

  private async handleCoordinatorHelpChoice(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    const choice = message.trim();
    if (choice === '1' || choice === '3') {
      return this.showCoordinatorMenu(state.data);
    }

    if (choice === '2') {
      // PRODUÇÃO: Transferir para atendimento direto (Z-API obtém telefone automaticamente)
      const telefoneZapi = state.data.userPhone || 'auto_detected'; // Z-API detecta automaticamente
      return await this.processarTransferencia(telefoneZapi, state.data);
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
3 - Como baixar aplicativo para preceptores
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

  /**
   * Processa telefone informado no modo simulação
   */
  private async handleSimulationPhoneResponse(message: string, state: HybridChatState): Promise<{ response: string; nextState: HybridChatState }> {
    const telefone = message.trim().replace(/\D/g, ''); // Remove caracteres não numéricos

    if (telefone.length < 10 || telefone.length > 11) {
      return {
        response: 'Número de telefone inválido. Por favor, informe um número válido com DDD (exemplo: 11999999999):',
        nextState: state
      };
    }

    // Processa transferência usando o telefone informado
    return await this.processarTransferencia(telefone, state.data);
  }

  /**
   * Processa a transferência para atendimento (simulação ou Z-API)
   */
  private async processarTransferencia(telefone: string, stateData: any): Promise<{ response: string; nextState: HybridChatState }> {
    try {
      console.log(`[HYBRID] Processando transferência para telefone: ${telefone}`);

      // 1. Buscar dados do usuário via API RADE
      const dadosUsuario = await this.buscarDadosUsuarioCompletos(stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf);

      if (!dadosUsuario) {
        return {
          response: 'Erro ao buscar seus dados. Tente novamente mais tarde.',
          nextState: { currentState: HybridChatFlowState.END, data: {} }
        };
      }

      // 2. Identificar universidade
      const universidade = dadosUsuario.organizationsAndCourses?.[0]?.organizationName;

      if (!universidade) {
        return {
          response: 'Não conseguimos identificar sua universidade. Entre em contato pelo telefone.',
          nextState: { currentState: HybridChatFlowState.END, data: {} }
        };
      }

      // 3. Gerar resumo da conversa com contexto específico
      const contextoConversa = this.montarContextoConversa(stateData);
      const resumoConversa = await this.resumoConversaService.gerarResumoComContexto(telefone, contextoConversa);

      // 4. Adicionar à fila de atendimento
      const chamado = await this.simulationService.adicionarChamadoFila({
        telefoneUsuario: telefone,
        nomeUsuario: dadosUsuario.studentName || dadosUsuario.coordinatorName || 'Usuário',
        universidade: universidade,
        cpfUsuario: stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf,
        resumoConversa: resumoConversa
      });

      // 5. Resposta para o usuário
      const nomeAtendente = this.simulationService.getAtendentePorUniversidade(universidade)?.nome || 'um atendente';

      const response = `✅ Transferência realizada com sucesso!

📋 Você foi adicionado à fila de atendimento da ${universidade}
👨‍💼 Atendente responsável: ${nomeAtendente}
📊 Sua posição na fila: ${chamado.posicaoAtual}
⏱️ Tempo estimado: ${chamado.posicaoAtual * 3-5} minutos

${nomeAtendente} entrará em contato em breve através deste número: ${telefone}

O atendimento será encerrado agora. Aguarde o contato!`;

      console.log(`[HYBRID] Transferência concluída: ${chamado.id} - ${universidade} - Posição ${chamado.posicaoAtual}`);

      return {
        response,
        nextState: { currentState: HybridChatFlowState.END, data: {} }
      };

    } catch (error) {
      console.error('[HYBRID] Erro na transferência:', error);
      return {
        response: 'Erro interno na transferência. Tente novamente mais tarde.',
        nextState: { currentState: HybridChatFlowState.END, data: {} }
      };
    }
  }

  /**
   * Busca dados completos do usuário na API RADE
   */
  private async buscarDadosUsuarioCompletos(cpf: string): Promise<any> {
    try {
      // Tenta primeiro como estudante
      try {
        const dadosEstudante = await this.apiVirtualAssistanceService.getStudentInfo(cpf);
        console.log(`[HYBRID] Dados de estudante encontrados: ${dadosEstudante.studentName}`);
        return dadosEstudante;
      } catch (error) {
        console.log(`[HYBRID] CPF não é estudante, tentando como coordenador...`);
      }

      // Tenta como coordenador
      try {
        const dadosCoordenador = await this.apiVirtualAssistanceService.getCoordinatorInfo(cpf);
        console.log(`[HYBRID] Dados de coordenador encontrados: ${dadosCoordenador.coordinatorName}`);
        return dadosCoordenador;
      } catch (error) {
        console.log(`[HYBRID] CPF não é coordenador`);
      }

      return null;
    } catch (error) {
      console.error('[HYBRID] Erro ao buscar dados do usuário:', error);
      return null;
    }
  }

  /**
   * Monta o contexto específico da conversa para melhor resumo
   */
  private montarContextoConversa(stateData: any): any {
    const contexto: any = {
      tipoUsuario: stateData.userType || 'não informado',
      cpfInformado: stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf,
      telefoneInformado: stateData.userPhone,
      motivoTransferencia: stateData.transferReason || 'não informado',
      passos: []
    };

    // Mapear opções do menu baseadas no que foi guardado no state
    const menuOpcoes = {
      'student_help': 'Usuário escolheu assistir vídeos do menu estudante, mas após assistir disse que precisava de mais ajuda',
      'coordinator_help': 'Usuário escolheu assistir vídeos do menu coordenador, mas após assistir disse que precisava de mais ajuda',
      'ai_request': 'Usuário solicitou falar com a IA/atendimento direto'
    };

    if (contexto.motivoTransferencia && menuOpcoes[contexto.motivoTransferencia]) {
      contexto.detalhes = menuOpcoes[contexto.motivoTransferencia];
    }

    // Simular histórico baseado no fluxo
    contexto.historico = [
      `Usuário: Olá`,
      `Bot: Olá! Para começar, me diga qual seu perfil: 1 - Sou Estudante, 2 - Sou Coordenador, 3 - Ainda não sou usuário`,
      `Usuário: ${contexto.tipoUsuario === 'student' ? '1' : contexto.tipoUsuario === 'coordinator' ? '2' : '?'}`,
      `Bot: Para continuar, por favor, informe seu CPF`,
      `Usuário: ${contexto.cpfInformado}`,
      `Bot: Mostrou menu de opções de vídeos`,
      contexto.detalhes || 'Usuário navegou pelo menu e solicitou ajuda adicional',
      `Bot: Para transferência, informe seu telefone`,
      `Usuário: ${contexto.telefoneInformado}`,
      `Bot: Transferindo para atendimento...`
    ];

    return contexto;
  }
}