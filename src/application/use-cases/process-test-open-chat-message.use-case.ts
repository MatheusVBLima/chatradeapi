import { Injectable } from '@nestjs/common';
import { OpenChatFlow, OpenChatState } from '../../domain/flows/open-chat.flow';
import { ChatEnvironment } from '../../domain/enums/chat-environment.enum';

export interface ProcessTestOpenChatMessageRequest {
  message: string;
  phone?: string;
  environment: ChatEnvironment;
  state?: OpenChatState;
}

export interface ProcessTestOpenChatMessageResponse {
  response: string;
  success: boolean;
  error?: string;
  nextState?: OpenChatState;
}

@Injectable()
export class ProcessTestOpenChatMessageUseCase {
  constructor(private readonly openChatFlow: OpenChatFlow) {}

  async execute(
    request: ProcessTestOpenChatMessageRequest,
  ): Promise<ProcessTestOpenChatMessageResponse> {
    try {
      console.log(
        '[TEST-OPEN-USE-CASE] Processing message:',
        request.message,
      );

      const { response, nextState } = await this.openChatFlow.handle(
        request.message,
        request.state ?? null,
        request.phone,
        true, // isTestMode = true para test_open
      );

      // Add test prefix to response
      const testResponse = `[TESTE] ${response}`;

      return {
        response: testResponse,
        success: true,
        nextState,
      };
    } catch (error) {
      console.error('[TEST-OPEN-USE-CASE] Error processing message:', error);
      return {
        response:
          '[TESTE] Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        success: false,
        error: error.message,
      };
    }
  }
}