import { Injectable, Inject } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

/**
 * Defines the possible states (nodes) in the closed chat flow diagram.
 */
export enum ChatFlowState {
  START = 'START',
  AWAITING_USER_TYPE = 'AWAITING_USER_TYPE',
  // Student flow
  AWAITING_STUDENT_CPF = 'AWAITING_STUDENT_CPF',
  STUDENT_MENU = 'STUDENT_MENU',
  AWAITING_STUDENT_MENU_CHOICE = 'AWAITING_STUDENT_MENU_CHOICE',
  AWAITING_STUDENT_HELP_CHOICE = 'AWAITING_STUDENT_HELP_CHOICE', // After a video is shown
  AWAITING_STUDENT_LIMITED_CONTINUE = 'AWAITING_STUDENT_LIMITED_CONTINUE', // When student group is inactive
  // Professor flow
  TEACHER_MENU = 'TEACHER_MENU',
  AWAITING_TEACHER_MENU_CHOICE = 'AWAITING_TEACHER_MENU_CHOICE',
  AWAITING_TEACHER_HELP_CHOICE = 'AWAITING_TEACHER_HELP_CHOICE',
  // New user flow
  AWAITING_NEW_USER_DETAILS = 'AWAITING_NEW_USER_DETAILS',
  // End
  END = 'END',
}

/**
 * Represents the state of a user's conversation in the closed flow.
 * This object will be passed back and forth between client and server.
 */
export interface ClosedChatState {
  currentState: ChatFlowState;
  data: {
    // To store data collected during the flow, e.g., CPF
    [key: string]: any;
    studentId?: string;
  };
}

export interface FlowResponse {
  response: string;
  nextState: ClosedChatState;
}

@Injectable()
export class ClosedChatFlow {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}
  /**
   * Handles the user's message based on the current state of the conversation.
   * @param message The message from the user.
   * @param state The current state of the conversation. Can be null if it's the start.
   * @param user The user entity, if found.
   * @returns The response to send back to the user and the next state.
   */
  public async handle(message: string, state: ClosedChatState | null, user?: User): Promise<FlowResponse> {
    const currentState = state?.currentState || ChatFlowState.START;

    switch (currentState) {
      case ChatFlowState.START:
        return this.handleStart();
      
      case ChatFlowState.AWAITING_USER_TYPE:
        if (!state) return this.handleStart(); // Safety check
        return this.handleUserTypeResponse(message, state);

      case ChatFlowState.AWAITING_STUDENT_CPF:
        if (!state) return this.handleStart(); // Safety check
        return await this.handleStudentCpfResponse(message, state);

      case ChatFlowState.AWAITING_STUDENT_LIMITED_CONTINUE:
        if (!state) return this.handleStart(); // Safety check
        return this.handleStudentLimitedContinue(message, state);

      case ChatFlowState.AWAITING_STUDENT_MENU_CHOICE:
        if (!state) return this.handleStart(); // Safety check
        return this.handleStudentMenuChoice(message, state);
      
      case ChatFlowState.AWAITING_STUDENT_HELP_CHOICE:
        if (!state) return this.handleStart(); // Safety check
        return this.handleStudentHelpChoice(message, state);

      case ChatFlowState.AWAITING_TEACHER_MENU_CHOICE:
        if (!state) return this.handleStart(); // Safety check
        return this.handleTeacherMenuChoice(message, state);

      case ChatFlowState.AWAITING_TEACHER_HELP_CHOICE:
        if (!state) return this.handleStart(); // Safety check
        return this.handleTeacherHelpChoice(message, state);

      case ChatFlowState.AWAITING_NEW_USER_DETAILS:
        if (!state) return this.handleStart(); // Safety check
        return this.handleNewUserDetails(message, state);

      // Other cases will be implemented here

      default:
        // Default case to handle unknown states, restarting the flow.
        return this.handleStart();
    }
  }

  private handleStart(): FlowResponse {
    const response = `Olá! Para começar, por favor, me diga qual seu perfil:
1 - Sou Estudante
2 - Sou Professor
3 - Ainda não sou usuário`;
    
    return {
      response,
      nextState: {
        currentState: ChatFlowState.AWAITING_USER_TYPE,
        data: {},
      },
    };
  }

  private handleUserTypeResponse(message: string, state: ClosedChatState): FlowResponse {
    const choice = message.trim();

    if (choice === '1') {
      // Flow for "Sou Estudante"
      return {
        response: 'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
        nextState: {
          currentState: ChatFlowState.AWAITING_STUDENT_CPF,
          data: state.data,
        },
      };
    }
    
    if (choice === '2') {
      // Flow for "Sou Professor"
      // According to the diagram, we should validate the teacher's profile here via API.
      // For now, we'll just present the menu. We can add the validation step later.
      return this.showTeacherMenu(state.data);
    }
    
    if (choice === '3') {
      // Flow for "Ainda não sou usuário"
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
2 - Sou Professor
3 - Ainda não sou usuário`;
    return {
      response,
      nextState: state, // Keep the same state
    };
  }

  private async handleStudentCpfResponse(message: string, state: ClosedChatState): Promise<FlowResponse> {
    const cpf = message.trim();
    const student = await this.userRepository.findByCpf(cpf);

    if (!student || student.role !== 'student') {
      return {
        response: 'CPF não encontrado ou não pertence a um estudante. Por favor, verifique os dados e tente novamente.',
        nextState: state, // Keep state to allow retry
      };
    }

    const nextStateData = { ...state.data, studentId: student.id };

    // This logic needs to be re-evaluated. For now, we assume a student user might have an "inactive group" status.
    // A new field would be needed in the User entity, e.g., `isGroupActive`.
    // Let's assume for now all students found are active.
    return this.showStudentMenu(nextStateData);
    
  }

  private handleStudentLimitedContinue(message: string, state: ClosedChatState): FlowResponse {
    const choice = message.trim();
    if (choice === '1') { // Sim
      return this.showStudentMenu(state.data);
    } 
    
    if (choice === '2') { // Não
      return {
        response: 'Entendido. O atendimento será encerrado. Se precisar de algo mais, é só chamar!',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }

    return {
      response: 'Resposta inválida. Por favor, digite 1 para Sim ou 2 para Não.',
      nextState: state,
    };
  }

  private handleStudentMenuChoice(message: string, state: ClosedChatState): FlowResponse {
    const choice = message.trim();
    // In a real scenario, these URLs would come from a config or database
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
2 - Não, preciso de mais ajuda`;
      return {
        response,
        nextState: {
          currentState: ChatFlowState.AWAITING_STUDENT_HELP_CHOICE,
          data: state.data,
        },
      };
    }

    if (choice === '7') { // Encerrar
      return {
        response: 'Ok, estou encerrando nosso atendimento. Se precisar de algo mais, basta me chamar!',
        nextState: { currentState: ChatFlowState.END, data: {} },
      };
    }
    
    // Invalid choice
    return {
      response: 'Opção inválida. Por favor, escolha um número do menu.',
      nextState: state,
    };
  }

  private handleStudentHelpChoice(message: string, state: ClosedChatState): FlowResponse {
    const choice = message.trim();
    if (choice === '1') { // Sim, foi suficiente
      // Go back to the menu
      return this.showStudentMenu(state.data);
    }
    
    if (choice === '2') { // Não, preciso de mais ajuda
      return {
        response: 'Entendido. Estou transferindo você para um de nossos atendentes para te ajudar melhor.',
        nextState: { currentState: ChatFlowState.END, data: {} }, // End flow after transfer
      };
    }

    return {
      response: 'Resposta inválida. Por favor, digite 1 se o vídeo foi suficiente ou 2 se precisar de mais ajuda.',
      nextState: state,
    };
  }

  private handleNewUserDetails(message: string, state: ClosedChatState): FlowResponse {
    const userDetails = message.trim();

    // In a real application, we would parse this message and save the details.
    // For now, we just acknowledge the receipt.
    const nextStateData = { ...state.data, new_user_details: userDetails };

    return {
      response: 'Obrigado! Seus dados foram recebidos e em breve entraremos em contato para finalizar seu cadastro. O atendimento será encerrado.',
      nextState: {
        currentState: ChatFlowState.END,
        data: {}, // Clear data on end
      },
    };
  }

  private handleTeacherMenuChoice(message: string, state: ClosedChatState): FlowResponse {
    const choice = message.trim();
    // In a real scenario, these URLs would come from a config or database
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
2 - Não, preciso de mais ajuda`;
      return {
        response,
        nextState: {
          currentState: ChatFlowState.AWAITING_TEACHER_HELP_CHOICE,
          data: state.data,
        },
      };
    }
    
    // Invalid choice
    return {
      response: 'Opção inválida. Por favor, escolha um número do menu de professor.',
      nextState: state,
    };
  }

  private handleTeacherHelpChoice(message: string, state: ClosedChatState): FlowResponse {
    const choice = message.trim();
    if (choice === '1') { // Sim, foi suficiente
      // Go back to the teacher menu
      return this.showTeacherMenu(state.data);
    }
    
    if (choice === '2') { // Não, preciso de mais ajuda
      return {
        response: 'Compreendido. Estou te encaminhando para um de nossos especialistas.',
        nextState: { currentState: ChatFlowState.END, data: {} }, // End flow after transfer
      };
    }

    return {
      response: 'Resposta inválida. Por favor, digite 1 se o vídeo foi suficiente ou 2 se precisar de mais ajuda.',
      nextState: state,
    };
  }

  private getStudentMenuText(): string {
    return `Aqui estão as opções que posso te ajudar:
1 - Como fazer meu cadastro
2 - Como agendar minhas atividades
3 - Como iniciar e finalizar atividade
4 - Como fazer uma avaliação
5 - Como justificar atividade perdida
6 - Como preencher meu TCE
7 - Encerrar atendimento`;
  }

  private showStudentMenu(data: ClosedChatState['data']): FlowResponse {
    return {
      response: this.getStudentMenuText(),
      nextState: {
        currentState: ChatFlowState.AWAITING_STUDENT_MENU_CHOICE,
        data,
      },
    };
  }

  private getTeacherMenuText(): string {
    return `Bem-vindo, professor! Como posso ajudar hoje?
1 - Como validar atividades
2 - Como realizar avaliação
3 - Como agendar retroativo
4 - Como gerar QR code`;
  }

  private showTeacherMenu(data: ClosedChatState['data']): FlowResponse {
    return {
      response: this.getTeacherMenuText(),
      nextState: {
        currentState: ChatFlowState.AWAITING_TEACHER_MENU_CHOICE,
        data,
      },
    };
  }
} 