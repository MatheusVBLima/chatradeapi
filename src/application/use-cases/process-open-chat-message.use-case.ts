import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../domain/repositories/user.repository';
import { AIService } from '../../domain/services/ai.service';
import { VirtualAssistanceService } from '../../domain/services/virtual-assistance.service';
import { ChatEnvironment } from '../../domain/enums/chat-environment.enum';
import { OpenChatFlow, OpenChatState } from '../../domain/flows/open-chat.flow';

export interface ProcessOpenChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  environment: ChatEnvironment;
  state?: OpenChatState; // Adicionar state para fluxo conversacional
}

export interface ProcessOpenChatMessageResponse {
  response: string;
  success: boolean;
  error?: string;
  nextState?: OpenChatState; // Retornar próximo estado
}

@Injectable()
export class ProcessOpenChatMessageUseCase {
  constructor(
    @Inject('UserRepository') private readonly userRepository: UserRepository,
    @Inject('AIService') private readonly aiService: AIService,
    @Inject('VirtualAssistanceService')
    private readonly virtualAssistanceService: VirtualAssistanceService,
    private readonly configService: ConfigService,
    private readonly openChatFlow: OpenChatFlow,
  ) {}

  async execute(
    request: ProcessOpenChatMessageRequest,
  ): Promise<ProcessOpenChatMessageResponse> {
    try {
      // Usar o OpenChatFlow para gerenciar estados conversacionais
      const flowResult = await this.openChatFlow.handle(
        request.message,
        request.state || null,
        request.phone,
        false, // isTestMode = false (produção)
        request.environment,
      );

      return {
        response: flowResult.response,
        success: true,
        nextState: flowResult.nextState,
      };
    } catch (error) {
      console.error('[OPEN-CHAT-USE-CASE] Error processing chat message:', error);
      return {
        response:
          'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        success: false,
        error: error.message,
      };
    }
  }

}
