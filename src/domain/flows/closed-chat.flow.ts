import { Injectable, Inject } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from '../../application/services/notification.service';
import { ResumoConversaService } from '../../application/services/resumo-conversa.service';
import { GeminiAIService } from '../../infrastructure/services/gemini-ai.service';
import { VirtualAssistanceService } from '../services/virtual-assistance.service';

/**
 * Defines the possible states (nodes) in the closed chat flow diagram.
 * Same as hybrid but WITHOUT AI chat states
 */
export enum ChatFlowState {
  START = 'START',
  AWAITING_USER_TYPE = 'AWAITING_USER_TYPE',
  AWAITING_STUDENT_CPF = 'AWAITING_STUDENT_CPF',
  AWAITING_STUDENT_PHONE = 'AWAITING_STUDENT_PHONE',
  AWAITING_COORDINATOR_CPF = 'AWAITING_COORDINATOR_CPF',
  AWAITING_COORDINATOR_PHONE = 'AWAITING_COORDINATOR_PHONE',
  STUDENT_MENU = 'STUDENT_MENU',
  AWAITING_STUDENT_MENU_CHOICE = 'AWAITING_STUDENT_MENU_CHOICE',
  AWAITING_STUDENT_HELP_CHOICE = 'AWAITING_STUDENT_HELP_CHOICE',
  COORDINATOR_MENU = 'COORDINATOR_MENU',
  AWAITING_COORDINATOR_MENU_CHOICE = 'AWAITING_COORDINATOR_MENU_CHOICE',
  AWAITING_COORDINATOR_HELP_CHOICE = 'AWAITING_COORDINATOR_HELP_CHOICE',
  AWAITING_NEW_USER_DETAILS = 'AWAITING_NEW_USER_DETAILS',
  // Simulation states (for test mode)
  AWAITING_SIMULATION_PHONE = 'AWAITING_SIMULATION_PHONE',
  END = 'END',
}

/**
 * Represents the state of a user's conversation in the closed flow.
 * This object will be passed back and forth between client and server.
 */
export interface ClosedChatState {
  currentState: ChatFlowState;
  data: {
    [key: string]: any;
    studentId?: string;
    userType?: 'student' | 'coordinator';
    studentCpf?: string;
    coordinatorCpf?: string;
    cpf?: string;
    userPhone?: string;
    transferReason?: string;
    lastMenuOption?: string;
  };
}

export interface FlowResponse {
  response: string;
  nextState: ClosedChatState;
}

@Injectable()
export class ClosedChatFlow {
  private readonly SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';
  private currentSimulationMode = false; // Armazena o modo atual durante a execução

  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly resumoConversaService: ResumoConversaService,
    private readonly geminiAiService: GeminiAIService,
    @Inject('VirtualAssistanceService')
    private readonly virtualAssistanceService: VirtualAssistanceService,
  ) {}

  /**
   * Handles the user's message based on the current state of the conversation.
   */
  public async handle(
    message: string,
    state: ClosedChatState | null,
    user?: User,
    isTestMode?: boolean,
    environment?: 'web' | 'mobile',
  ): Promise<FlowResponse> {
    // Sobrescrever SIMULATION_MODE se isTestMode for fornecido
    this.currentSimulationMode =
      isTestMode !== undefined ? isTestMode : this.SIMULATION_MODE;

    const currentState = state?.currentState || ChatFlowState.START;

    switch (currentState) {
      case ChatFlowState.START:
        return this.handleStart();

      case ChatFlowState.AWAITING_USER_TYPE:
        if (!state) return this.handleStart();
        return this.handleUserTypeResponse(message, state);

      case ChatFlowState.AWAITING_STUDENT_CPF:
        if (!state) return this.handleStart();
        return await this.handleStudentCpfResponse(message, state);

      case ChatFlowState.AWAITING_STUDENT_PHONE:
        if (!state) return this.handleStart();
        return await this.handleStudentPhoneResponse(message, state);

      case ChatFlowState.AWAITING_COORDINATOR_CPF:
        if (!state) return this.handleStart();
        return await this.handleCoordinatorCpfResponse(message, state);

      case ChatFlowState.AWAITING_COORDINATOR_PHONE:
        if (!state) return this.handleStart();
        return await this.handleCoordinatorPhoneResponse(message, state);

      case ChatFlowState.AWAITING_STUDENT_MENU_CHOICE:
        if (!state) return this.handleStart();
        return this.handleStudentMenuChoice(message, state);

      case ChatFlowState.AWAITING_STUDENT_HELP_CHOICE:
        if (!state) return this.handleStart();
        return await this.handleStudentHelpChoice(message, state);

      case ChatFlowState.AWAITING_COORDINATOR_MENU_CHOICE:
        if (!state) return this.handleStart();
        return this.handleCoordinatorMenuChoice(message, state);

      case ChatFlowState.AWAITING_COORDINATOR_HELP_CHOICE:
        if (!state) return this.handleStart();
        return await this.handleCoordinatorHelpChoice(message, state);

      case ChatFlowState.AWAITING_NEW_USER_DETAILS:
        if (!state) return this.handleStart();
        return await this.handleNewUserDetails(message, state);

      case ChatFlowState.AWAITING_SIMULATION_PHONE:
        if (!state) return this.handleStart();
        return await this.handleSimulationPhoneResponse(message, state);

      default:
        return this.handleStart();
    }
  }

  private handleStart(): FlowResponse {
    const response = `Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:

1 - Sou Estudante
2 - Sou Coordenador
3 - Ainda não sou usuário`;

    return {
      response,
      nextState: {
        currentState: ChatFlowState.AWAITING_USER_TYPE,
        data: {},
      },
    };
  }

  private handleUserTypeResponse(
    message: string,
    state: ClosedChatState,
  ): FlowResponse {
    const choice = message.trim();

    if (choice === '1') {
      return {
        response:
          'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: ChatFlowState.AWAITING_STUDENT_CPF,
          data: state.data,
        },
      };
    }

    if (choice === '2') {
      return {
        response:
          'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: ChatFlowState.AWAITING_COORDINATOR_CPF,
          data: state.data,
        },
      };
    }

    if (choice === '3') {
      return {
        response:
          'Ok. Para realizar seu cadastro inicial, por favor, me diga seu nome completo, CPF, instituição, curso e período, tudo em uma única mensagem.',
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

  private async handleStudentCpfResponse(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const cpf = message.trim().replace(/\D/g, '');

    // Validar formato do CPF
    if (cpf.length !== 11) {
      return {
        response:
          'CPF inválido. Por favor, informe um CPF válido com 11 dígitos:',
        nextState: state,
      };
    }

    // Buscar dados do estudante na API
    try {
      const studentInfo =
        await this.virtualAssistanceService.getStudentInfo(cpf);
      const studentName = studentInfo.studentName || 'Estudante';
      const environment = state.data.environment || 'web';

      console.log(
        `[CLOSED-CHAT] Environment: ${environment}, isTestMode: ${this.currentSimulationMode}`,
      );

      // Se ambiente WEB, pedir telefone para validação
      if (environment === 'web') {
        return {
          response:
            'Ótimo! Agora, por favor, informe seu número de telefone (com DDD, exemplo: 11999999999):',
          nextState: {
            currentState: ChatFlowState.AWAITING_STUDENT_PHONE,
            data: {
              ...state.data,
              studentCpf: cpf,
              cpf: cpf,
              studentInfo,
            },
          },
        };
      }

      // Se ambiente MOBILE, Z-API detecta telefone automaticamente
      // Ir direto para o menu (sem validação de telefone)
      return this.showStudentMenu({
        ...state.data,
        studentCpf: cpf,
        cpf: cpf,
        studentName,
        studentInfo,
      });
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro ao buscar estudante:', error);
      return {
        response: `CPF não encontrado no sistema. Por favor, verifique o CPF informado ou escolha a opção "3 - Ainda não sou usuário" no menu inicial.

Digite seu CPF novamente ou digite "voltar" para retornar ao menu:`,
        nextState: state,
      };
    }
  }

  private async handleCoordinatorCpfResponse(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const cpf = message.trim().replace(/\D/g, '');

    // Validar formato do CPF
    if (cpf.length !== 11) {
      return {
        response:
          'CPF inválido. Por favor, informe um CPF válido com 11 dígitos:',
        nextState: state,
      };
    }

    // Buscar dados do coordenador na API
    try {
      const coordinatorInfo =
        await this.virtualAssistanceService.getCoordinatorInfo(cpf);
      const coordinatorName = coordinatorInfo.coordinatorName || 'Coordenador';
      const environment = state.data.environment || 'web';

      // Se ambiente WEB, pedir telefone para validação
      if (environment === 'web') {
        return {
          response:
            'Ótimo! Agora, por favor, informe seu número de telefone (com DDD, exemplo: 11999999999):',
          nextState: {
            currentState: ChatFlowState.AWAITING_COORDINATOR_PHONE,
            data: {
              ...state.data,
              coordinatorCpf: cpf,
              cpf: cpf,
              coordinatorInfo,
            },
          },
        };
      }

      // Se ambiente MOBILE, Z-API detecta telefone automaticamente
      // Ir direto para o menu (sem validação de telefone)
      return this.showCoordinatorMenu({
        ...state.data,
        coordinatorCpf: cpf,
        cpf: cpf,
        coordinatorName,
        coordinatorInfo,
      });
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro ao buscar coordenador:', error);
      return {
        response: `CPF não encontrado no sistema. Por favor, verifique o CPF informado ou escolha a opção "3 - Ainda não sou usuário" no menu inicial.

Digite seu CPF novamente ou digite "voltar" para retornar ao menu:`,
        nextState: state,
      };
    }
  }

  /**
   * Valida telefone do estudante (ambiente WEB)
   */
  private async handleStudentPhoneResponse(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const telefone = message.trim().replace(/\D/g, '');

    // Validação básica de telefone
    if (telefone.length < 10 || telefone.length > 11) {
      return {
        response:
          'Número de telefone inválido. Por favor, informe um telefone válido com DDD (exemplo: 11999999999):',
        nextState: state,
      };
    }

    const cpf = state.data.studentCpf || state.data.cpf;

    if (!cpf) {
      return {
        response:
          'Erro interno: CPF não encontrado. Por favor, reinicie o atendimento.',
        nextState: state,
      };
    }

    // Validar CPF + telefone na API
    try {
      const studentInfo =
        await this.virtualAssistanceService.getStudentInfo(cpf);
      const studentPhone = studentInfo.studentPhone || '';

      // Normalizar telefones para comparação
      const normalizedApiPhone = studentPhone.replace(/\D/g, '');
      const normalizedInputPhone = telefone;

      if (normalizedApiPhone !== normalizedInputPhone) {
        return {
          response: `CPF ou telefone não conferem com nossos registros. Por favor, verifique os dados e tente novamente.

Informe seu telefone novamente (com DDD):`,
          nextState: state,
        };
      }

      // Autenticado! Mostrar menu com nome
      const studentName = studentInfo.studentName || 'Estudante';
      return this.showStudentMenu({
        ...state.data,
        userPhone: telefone,
        studentName,
        studentInfo,
      });
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro ao validar telefone:', error);
      return {
        response: 'Erro ao validar seus dados. Por favor, tente novamente.',
        nextState: state,
      };
    }
  }

  /**
   * Valida telefone do coordenador (ambiente WEB)
   */
  private async handleCoordinatorPhoneResponse(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const telefone = message.trim().replace(/\D/g, '');

    // Validação básica de telefone
    if (telefone.length < 10 || telefone.length > 11) {
      return {
        response:
          'Número de telefone inválido. Por favor, informe um telefone válido com DDD (exemplo: 11999999999):',
        nextState: state,
      };
    }

    const cpf = state.data.coordinatorCpf || state.data.cpf;

    if (!cpf) {
      return {
        response:
          'Erro interno: CPF não encontrado. Por favor, reinicie o atendimento.',
        nextState: state,
      };
    }

    // Validar CPF + telefone na API
    try {
      const coordinatorInfo =
        await this.virtualAssistanceService.getCoordinatorInfo(cpf);
      const coordinatorPhone = coordinatorInfo.coordinatorPhone || '';

      // Normalizar telefones para comparação
      const normalizedApiPhone = coordinatorPhone.replace(/\D/g, '');
      const normalizedInputPhone = telefone;

      if (normalizedApiPhone !== normalizedInputPhone) {
        return {
          response: `CPF ou telefone não conferem com nossos registros. Por favor, verifique os dados e tente novamente.

Informe seu telefone novamente (com DDD):`,
          nextState: state,
        };
      }

      // Autenticado! Mostrar menu com nome
      const coordinatorName = coordinatorInfo.coordinatorName || 'Coordenador';
      return this.showCoordinatorMenu({
        ...state.data,
        userPhone: telefone,
        coordinatorName,
        coordinatorInfo,
      });
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro ao validar telefone:', error);
      return {
        response: 'Erro ao validar seus dados. Por favor, tente novamente.',
        nextState: state,
      };
    }
  }

  private handleStudentMenuChoice(
    message: string,
    state: ClosedChatState,
  ): FlowResponse {
    const choice = message.trim();
    const videoLinks = {
      '1': 'https://rade.b-cdn.net/bot/videos/cadastro.mp4',
      '2': 'https://rade.b-cdn.net/bot/videos/agendamento-atividades.mp4',
      '3': 'https://rade.b-cdn.net/bot/videos/iniciar-finalizar-atividade.mp4',
      '4': 'https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4',
      '5': 'https://rade.b-cdn.net/bot/videos/justificar-atividade-perdida.mp4',
      '6': 'https://rade.b-cdn.net/bot/videos/preencher-tce.mp4',
    };

    const menuNames = {
      '1': 'Como fazer meu cadastro',
      '2': 'Como agendar minhas atividades',
      '3': 'Como iniciar e finalizar atividade',
      '4': 'Como fazer uma avaliação',
      '5': 'Como justificar atividade perdida',
      '6': 'Como preencher meu TCE',
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
          data: { ...state.data, lastMenuOption: menuNames[choice] },
        },
      };
    }

    if (choice === '7') {
      return this.handleStart();
    }

    if (choice === '8') {
      return {
        response:
          'Ok, estou encerrando nosso atendimento. Se precisar de algo mais, basta me chamar!',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }

    return {
      response: 'Opção inválida. Por favor, escolha um número do menu.',
      nextState: state,
    };
  }

  private async handleStudentHelpChoice(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const choice = message.trim();
    if (choice === '1' || choice === '3') {
      return this.showStudentMenu(state.data);
    }

    if (choice === '2') {
      // Em modo SIMULATION (test), pedir telefone manualmente
      if (this.currentSimulationMode) {
        return {
          response:
            'Para continuar com a transferência, por favor, informe seu número de telefone com DDD (exemplo: 11999999999):',
          nextState: {
            currentState: ChatFlowState.AWAITING_SIMULATION_PHONE,
            data: {
              ...state.data,
              transferReason: 'student_help',
            },
          },
        };
      }

      // PRODUÇÃO: Z-API obtém telefone automaticamente
      const telefoneZapi = state.data.userPhone || 'auto_detected';
      return await this.processarTransferencia(telefoneZapi, {
        ...state.data,
        transferReason: 'student_help',
      });
    }

    return {
      response:
        'Resposta inválida. Por favor, escolha uma das opções (1, 2 ou 3).',
      nextState: state,
    };
  }

  private handleCoordinatorMenuChoice(
    message: string,
    state: ClosedChatState,
  ): FlowResponse {
    const choice = message.trim();
    const videoLinks = {
      '1': 'https://rade.b-cdn.net/bot/videos/validar-rejeitar-atividades.mp4',
      '2': 'https://rade.b-cdn.net/bot/videos/como-avaliar-grupo.mp4',
      '3': 'https://rade.b-cdn.net/bot/videos/rade-profissional-funcionalidades.mp4',
      '4': 'https://rade.b-cdn.net/bot/videos/gerar-qr-code.mp4',
    };

    const menuNames = {
      '1': 'Como validar atividades',
      '2': 'Como realizar avaliação',
      '3': 'Como baixar aplicativo para preceptores',
      '4': 'Como gerar QR code',
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
          currentState: ChatFlowState.AWAITING_COORDINATOR_HELP_CHOICE,
          data: { ...state.data, lastMenuOption: menuNames[choice] },
        },
      };
    }

    if (choice === '5') {
      return this.handleStart();
    }

    if (choice === '6') {
      return {
        response: 'Compreendido. Estou encerrando nosso atendimento.',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }

    return {
      response:
        'Opção inválida. Por favor, escolha um número do menu de coordenador.',
      nextState: state,
    };
  }

  private async handleCoordinatorHelpChoice(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const choice = message.trim();
    if (choice === '1' || choice === '3') {
      return this.showCoordinatorMenu(state.data);
    }

    if (choice === '2') {
      // Em modo SIMULATION (test), pedir telefone manualmente
      if (this.currentSimulationMode) {
        return {
          response:
            'Para continuar com a transferência, por favor, informe seu número de telefone com DDD (exemplo: 11999999999):',
          nextState: {
            currentState: ChatFlowState.AWAITING_SIMULATION_PHONE,
            data: {
              ...state.data,
              transferReason: 'coordinator_help',
            },
          },
        };
      }

      // PRODUÇÃO: Z-API obtém telefone automaticamente
      const telefoneZapi = state.data.userPhone || 'auto_detected';
      return await this.processarTransferencia(telefoneZapi, {
        ...state.data,
        transferReason: 'coordinator_help',
      });
    }

    return {
      response:
        'Resposta inválida. Por favor, escolha uma das opções (1, 2 ou 3).',
      nextState: state,
    };
  }

  private async handleNewUserDetails(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    try {
      // Extrair instituição usando IA
      const instituicao = await this.extrairInstituicao(message);

      if (!instituicao) {
        return {
          response:
            'Não consegui identificar sua instituição. Por favor, informe novamente seus dados incluindo o nome completo da instituição.',
          nextState: state,
        };
      }

      // Verificar se há atendente para esta instituição
      const atendente =
        this.notificationService.getAtendentePorUniversidade(instituicao);

      if (!atendente) {
        return {
          response: `Obrigado pelos seus dados! Infelizmente, a instituição "${instituicao}" não faz parte da nossa lista de atendimento no momento.\n\nPor favor, entre em contato diretamente com sua instituição ou utilize nosso atendimento automático.\n\nO atendimento será encerrado.`,
          nextState: {
            currentState: ChatFlowState.END,
            data: {},
          },
        };
      }

      // Enviar notificação para atendente
      await this.enviarDadosNovoUsuario(message, instituicao, atendente);

      return {
        response: `Obrigado! Seus dados foram recebidos e encaminhados para ${atendente.nome}, responsável pela ${instituicao}.\n\nEm breve entraremos em contato para finalizar seu cadastro. O atendimento será encerrado.`,
        nextState: {
          currentState: ChatFlowState.END,
          data: {},
        },
      };
    } catch (error) {
      console.error(
        '[CLOSED-CHAT] Erro ao processar dados de novo usuário:',
        error,
      );
      return {
        response:
          'Erro ao processar seus dados. Por favor, tente novamente mais tarde.',
        nextState: {
          currentState: ChatFlowState.END,
          data: {},
        },
      };
    }
  }

  private async handleSimulationPhoneResponse(
    message: string,
    state: ClosedChatState,
  ): Promise<FlowResponse> {
    const telefone = message.trim().replace(/\D/g, '');

    if (telefone.length < 10 || telefone.length > 11) {
      return {
        response:
          'Número de telefone inválido. Por favor, informe um número válido com DDD (exemplo: 11999999999):',
        nextState: state,
      };
    }

    // Verificar se vem de transferência ou de autenticação inicial
    if (state.data.transferReason) {
      // Se tem transferReason, é uma transferência para atendente
      return await this.processarTransferencia(telefone, state.data);
    }

    // Caso contrário, é autenticação inicial - ir para o menu apropriado
    const updatedData = { ...state.data, userPhone: telefone };

    if (state.data.studentCpf) {
      return this.showStudentMenu(updatedData);
    } else if (state.data.coordinatorCpf) {
      return this.showCoordinatorMenu(updatedData);
    }

    // Fallback - retornar ao início se não conseguir determinar o tipo
    return this.handleStart();
  }

  /**
   * Processa a transferência para atendimento
   */
  private async processarTransferencia(
    telefone: string,
    stateData: any,
  ): Promise<FlowResponse> {
    try {
      console.log(
        `[CLOSED-CHAT] Processando transferência para telefone: ${telefone}`,
      );

      // Em modo SIMULATION (test), retornar resposta simulada
      if (this.currentSimulationMode) {
        return this.processarTransferenciaSimulacao(telefone, stateData);
      }

      // 1. Buscar dados do usuário via API RADE
      const dadosUsuario = await this.buscarDadosUsuarioCompletos(
        stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf,
      );

      if (!dadosUsuario) {
        return {
          response: 'Erro ao buscar seus dados. Tente novamente mais tarde.',
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      // 2. Identificar universidade
      const universidade =
        dadosUsuario.organizationsAndCourses?.[0]?.organizationName;

      if (!universidade) {
        return {
          response:
            'Não conseguimos identificar sua universidade. Entre em contato pelo telefone.',
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      // 2.1. Verificar se há atendente para esta universidade
      const atendenteDisponivel =
        this.notificationService.getAtendentePorUniversidade(universidade);

      if (!atendenteDisponivel) {
        return {
          response: `Para a instituição ${universidade}, você deverá tirar suas dúvidas no atendimento automático, pois não temos atendente disponível no momento.\n\nO atendimento será encerrado.`,
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      // 3. Gerar resumo da conversa
      const contextoConversa = this.montarContextoConversa(stateData);
      const resumoConversa =
        await this.resumoConversaService.gerarResumoComContexto(
          telefone,
          contextoConversa,
        );

      // 4. Formatar dados completos do usuário
      const dadosFormatados = this.formatarDadosUsuarioParaAtendente(
        dadosUsuario,
        stateData.lastMenuOption,
      );

      // 5. Enviar notificação para atendente
      const chamado = await this.notificationService.enviarNotificacaoChamado({
        telefoneUsuario: telefone,
        nomeUsuario:
          dadosUsuario.studentName || dadosUsuario.coordinatorName || 'Usuário',
        universidade: universidade,
        cpfUsuario:
          stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf,
        resumoConversa: resumoConversa,
        dadosCompletos: dadosFormatados,
      });

      const response = `✅ Transferência realizada com sucesso!

${atendenteDisponivel.nome} irá entrar em contato com você pelo número ${atendenteDisponivel.telefone}.

O atendimento será encerrado agora. Aguarde o contato!`;

      console.log(
        `[CLOSED-CHAT] Transferência concluída: ${chamado.id} - ${universidade}`,
      );

      return {
        response,
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro na transferência:', error);
      return {
        response: 'Erro interno na transferência. Tente novamente mais tarde.',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }
  }

  /**
   * Busca dados completos do usuário na API RADE
   */
  private async buscarDadosUsuarioCompletos(cpf: string): Promise<any> {
    try {
      // Esta função precisa ser implementada para buscar dados na API RADE
      // Por enquanto retorna null - precisa integrar com UserRepository ou serviço específico
      console.log(`[CLOSED-CHAT] Buscando dados para CPF: ${cpf}`);
      return null;
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro ao buscar dados do usuário:', error);
      return null;
    }
  }

  /**
   * Monta o contexto específico da conversa para melhor resumo
   */
  private montarContextoConversa(stateData: any): any {
    const contexto: any = {
      tipoUsuario: stateData.userType || 'não informado',
      cpfInformado:
        stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf,
      telefoneInformado: stateData.userPhone,
      motivoTransferencia: stateData.transferReason || 'não informado',
      passos: [],
    };

    const menuOpcoes = {
      student_help:
        'Usuário escolheu assistir vídeos do menu estudante, mas após assistir disse que precisava de mais ajuda',
      coordinator_help:
        'Usuário escolheu assistir vídeos do menu coordenador, mas após assistir disse que precisava de mais ajuda',
    };

    if (
      contexto.motivoTransferencia &&
      menuOpcoes[contexto.motivoTransferencia]
    ) {
      contexto.detalhes = menuOpcoes[contexto.motivoTransferencia];
    }

    contexto.historico = [
      `Usuário: Olá`,
      `Bot: Olá! Para começar, me diga qual seu perfil: 1 - Sou Estudante, 2 - Sou Coordenador, 3 - Ainda não sou usuário`,
      `Usuário: ${contexto.tipoUsuario === 'student' ? '1' : contexto.tipoUsuario === 'coordinator' ? '2' : '?'}`,
      `Bot: Para continuar, por favor, informe seu CPF`,
      `Usuário: ${contexto.cpfInformado}`,
      `Bot: Mostrou menu de opções de vídeos`,
      contexto.detalhes ||
        'Usuário navegou pelo menu e solicitou ajuda adicional',
      `Bot: Para transferência, informe seu telefone`,
      `Usuário: ${contexto.telefoneInformado}`,
      `Bot: Transferindo para atendimento...`,
    ];

    return contexto;
  }

  /**
   * Extrai o nome da instituição de um texto usando IA
   */
  private async extrairInstituicao(mensagem: string): Promise<string | null> {
    try {
      const prompt = `Extraia APENAS o nome da instituição de ensino mencionada no texto abaixo.

Lista de instituições válidas:
- Zarns Salvador
- Inapós
- Imepac
- Zarns Itumbiara
- Zarns Unesul
- FAP - Faculdade Paraíso
- Cet
- Franco Montoro
- Unisa
- UNICEPLAC
- Faculdade Cathedral
- IDOMED
- FTC/ UNEX
- ASCES
- INSPIRALI
- CEUMA
- MANDIC
- SÍRIO LIBANÊS (RESIDÊNCIA)

Texto: "${mensagem}"

Responda APENAS com o nome EXATO da instituição da lista acima (copie e cole). Se não encontrar nenhuma instituição da lista, responda apenas "NENHUMA".`;

      const response = await this.geminiAiService.generateResponse(
        prompt,
        {} as any,
      );
      const instituicao = response.trim();

      if (instituicao === 'NENHUMA' || !instituicao) {
        return null;
      }

      // Validar se a instituição extraída realmente existe no mapa de atendentes
      const atendente =
        this.notificationService.getAtendentePorUniversidade(instituicao);
      return atendente ? instituicao : null;
    } catch (error) {
      console.error('[CLOSED-CHAT] Erro ao extrair instituição:', error);
      return null;
    }
  }

  /**
   * Envia dados do novo usuário para a atendente responsável
   */
  private async enviarDadosNovoUsuario(
    dadosCompletos: string,
    instituicao: string,
    atendente: any,
  ): Promise<void> {
    try {
      const dataHora = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const mensagem = `🆕 NOVO CADASTRO - ${instituicao}\n\n📝 DADOS INFORMADOS:\n${dadosCompletos}\n\n🕐 SOLICITADO EM: ${dataHora}`;

      // Envia via NotificationService (que já usa o ZapiService internamente)
      await this.notificationService['enviarNotificacaoWhatsApp'](atendente, {
        nomeUsuario: 'Novo Usuário',
        telefoneUsuario: 'Não informado',
        universidade: instituicao,
        dadosCompletos: mensagem,
      } as any);

      console.log(
        `[CLOSED-CHAT] Dados de novo usuário enviados para ${atendente.nome} - ${instituicao}`,
      );
    } catch (error) {
      console.error(
        '[CLOSED-CHAT] Erro ao enviar dados de novo usuário:',
        error,
      );
    }
  }

  /**
   * Formata dados do usuário para o atendente
   */
  private formatarDadosUsuarioParaAtendente(
    dadosUsuario: any,
    ultimoMenu?: string,
  ): string {
    const nome =
      dadosUsuario.studentName ||
      dadosUsuario.coordinatorName ||
      'Nome não disponível';
    const email =
      dadosUsuario.studentEmail ||
      dadosUsuario.coordinatorEmail ||
      'E-mail não disponível';
    const telefone =
      dadosUsuario.studentPhone ||
      dadosUsuario.coordinatorPhone ||
      'Telefone não disponível';

    let dadosFormatados = `👤 DADOS DO USUÁRIO:\n`;
    dadosFormatados += `Nome: ${nome}\n`;
    dadosFormatados += `E-mail: ${email}\n`;
    dadosFormatados += `Telefone: ${telefone}\n\n`;

    // Grupos (se for estudante)
    if (dadosUsuario.groupNames && dadosUsuario.groupNames.length > 0) {
      dadosFormatados += `📚 GRUPOS:\n`;
      dadosUsuario.groupNames.forEach((grupo: string) => {
        dadosFormatados += `• ${grupo}\n`;
      });
      dadosFormatados += `\n`;
    }

    // Organizações e cursos
    if (
      dadosUsuario.organizationsAndCourses &&
      dadosUsuario.organizationsAndCourses.length > 0
    ) {
      dadosFormatados += `🏫 INSTITUIÇÕES E CURSOS:\n`;
      dadosUsuario.organizationsAndCourses.forEach((org: any) => {
        dadosFormatados += `• ${org.organizationName}\n`;
        if (org.courseNames && org.courseNames.length > 0) {
          org.courseNames.forEach((curso: string) => {
            dadosFormatados += `  - ${curso}\n`;
          });
        }
      });
      dadosFormatados += `\n`;
    }

    // Contexto da dificuldade
    if (ultimoMenu) {
      dadosFormatados += `❓ CONTEXTO:\nEncontrou dificuldades em: ${ultimoMenu}`;
    }

    return dadosFormatados;
  }

  private showStudentMenu(data: ClosedChatState['data']): FlowResponse {
    const studentName = data.studentName || 'Estudante';
    const greeting = `Olá, ${studentName}! Aqui estão as opções que posso te ajudar:`;

    return {
      response: `${greeting}
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Voltar ao menu inicial
8 - Encerrar atendimento`,
      nextState: {
        currentState: ChatFlowState.AWAITING_STUDENT_MENU_CHOICE,
        data,
      },
    };
  }

  private showCoordinatorMenu(data: ClosedChatState['data']): FlowResponse {
    const coordinatorName = data.coordinatorName || 'Coordenador';
    const greeting = `Bem-vindo, ${coordinatorName}! Como posso ajudar hoje?`;

    return {
      response: `${greeting}
1 - Como validar atividades
2 - Como realizar avaliação
3 - Como baixar aplicativo para preceptores
4 - Como gerar QR code
5 - Voltar ao menu inicial
6 - Encerrar atendimento`,
      nextState: {
        currentState: ChatFlowState.AWAITING_COORDINATOR_MENU_CHOICE,
        data,
      },
    };
  }

  /**
   * Processa transferência em modo SIMULATION (test)
   * Busca dados REAIS do usuário e retorna mensagem de confirmação sem enviar de fato
   */
  private async processarTransferenciaSimulacao(
    telefone: string,
    stateData: any,
  ): Promise<FlowResponse> {
    try {
      const cpf =
        stateData.studentCpf || stateData.coordinatorCpf || stateData.cpf;

      console.log(
        `[CLOSED-CHAT-SIMULAÇÃO] Buscando dados reais para CPF: ${cpf}`,
      );

      // Buscar dados baseado no tipo de usuário escolhido
      let usuario: any;
      const isEstudante = !!stateData.studentCpf;
      const isCoordenador = !!stateData.coordinatorCpf;
      const tipoUsuario = isEstudante ? 'Estudante' : 'Coordenador';

      try {
        if (isEstudante) {
          usuario = await this.virtualAssistanceService.getStudentInfo(cpf);
        } else if (isCoordenador) {
          usuario = await this.virtualAssistanceService.getCoordinatorInfo(cpf);
        } else {
          throw new Error('Tipo de usuário não identificado');
        }
      } catch (error) {
        console.error(`[CLOSED-CHAT-SIMULAÇÃO] Erro ao buscar dados:`, error);
        return {
          response: `CPF não encontrado no sistema. Por favor, verifique o CPF informado.\n\nO atendimento será encerrado.`,
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      if (!usuario) {
        return {
          response: `CPF não encontrado no sistema. Por favor, verifique o CPF informado.\n\nO atendimento será encerrado.`,
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      // Identificar universidade REAL
      const universidadeReal =
        usuario.organizationsAndCourses?.[0]?.organizationName;

      if (!universidadeReal) {
        return {
          response: `Não foi possível identificar sua universidade. Por favor, entre em contato com o suporte.\n\nO atendimento será encerrado.`,
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      // Buscar atendente REAL para esta universidade
      const atendente =
        this.notificationService.getAtendentePorUniversidade(universidadeReal);

      if (!atendente) {
        return {
          response: `Para a instituição ${universidadeReal}, você deverá tirar suas dúvidas no atendimento automático, pois não temos atendente disponível no momento.\n\nO atendimento será encerrado.`,
          nextState: { currentState: ChatFlowState.END, data: {} },
        };
      }

      const response = `✅ Transferência realizada com sucesso!

${atendente.nome} irá entrar em contato com você pelo número ${atendente.telefone}.

O atendimento será encerrado agora. Aguarde o contato!`;

      console.log(
        `[CLOSED-CHAT-SIMULAÇÃO] Transferência simulada: ${universidadeReal} - ${atendente.nome}`,
      );

      return {
        response,
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    } catch (error) {
      console.error('[CLOSED-CHAT-SIMULAÇÃO] Erro ao buscar dados:', error);
      return {
        response: `Erro ao buscar dados do usuário. Por favor, tente novamente.\n\nO atendimento será encerrado.`,
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }
  }
}
