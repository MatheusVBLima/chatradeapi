import { Controller, Post, Body, HttpCode, HttpStatus, Delete, Param } from '@nestjs/common';
import { 
  ProcessOpenChatMessageUseCase, 
  ProcessOpenChatMessageRequest 
} from '../../application/use-cases/process-open-chat-message.use-case';
import { 
  ProcessClosedChatMessageUseCase, 
  ProcessClosedChatMessageRequest 
} from '../../application/use-cases/process-closed-chat-message.use-case';
import { ProcessApiChatMessageUseCase } from '../../application/use-cases/process-api-chat-message.use-case';
import { ClosedChatState } from '../../domain/flows/closed-chat.flow';

// DTO for open chat
export class OpenChatRequestDto implements ProcessOpenChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
}

// DTO for closed chat
export class ClosedChatRequestDto implements ProcessClosedChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
  state?: ClosedChatState;
}

// DTO for API chat
export class ApiChatRequestDto {
  message: string;
  userId: string;
  channel: string;
}

export class ChatResponseDto {
  response: string;
  success: boolean;
  error?: string;
  nextState?: ClosedChatState | null;
}

@Controller('chat')
export class ChatController {
  constructor(
    private readonly processOpenChatMessageUseCase: ProcessOpenChatMessageUseCase,
    private readonly processClosedChatMessageUseCase: ProcessClosedChatMessageUseCase,
    private readonly processApiChatMessageUseCase: ProcessApiChatMessageUseCase,
  ) {}

  @Post('open')
  @HttpCode(HttpStatus.OK)
  async processOpenMessage(@Body() request: OpenChatRequestDto): Promise<ChatResponseDto> {
    console.log('[CONTROLLER] /chat/open called with:', request.userId, request.message);
    const result = await this.processOpenChatMessageUseCase.execute(request);
    
    return {
      response: result.response,
      success: result.success,
      error: result.error
    };
  }

  @Post('closed')
  @HttpCode(HttpStatus.OK)
  async processClosedMessage(@Body() request: ClosedChatRequestDto): Promise<ChatResponseDto> {
    const result = await this.processClosedChatMessageUseCase.execute(request);
    
    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }

  @Post('api')
  @HttpCode(HttpStatus.OK)
  async processApiMessage(@Body() request: ApiChatRequestDto): Promise<ChatResponseDto> {
    console.log(`[CONTROLLER] Recebida requisição API - CPF: ${request.userId}, Mensagem: ${request.message}`);
    
    const result = await this.processApiChatMessageUseCase.execute(request.message, request.userId);
    
    console.log(`[CONTROLLER] Resultado: success=${result.success}, response length=${result.response.length}`);
    
    return {
      response: result.response,
      success: result.success,
    };
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString()
    };
  }
} 