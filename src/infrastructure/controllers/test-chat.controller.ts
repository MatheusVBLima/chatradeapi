import { Controller, Post, Body, HttpCode, HttpStatus, Delete, Param } from '@nestjs/common';
import {
  ProcessTestOpenChatMessageUseCase,
  ProcessTestOpenChatMessageRequest
} from '../../application/use-cases/process-test-open-chat-message.use-case';
import {
  ProcessTestClosedChatMessageUseCase,
  ProcessTestClosedChatMessageRequest
} from '../../application/use-cases/process-test-closed-chat-message.use-case';
import { ProcessApiChatMessageUseCase } from '../../application/use-cases/process-api-chat-message.use-case';
import { ClosedChatState } from '../../domain/flows/closed-chat.flow';

// DTO for test open chat
export class TestOpenChatRequestDto implements ProcessTestOpenChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
}

// DTO for test closed chat
export class TestClosedChatRequestDto implements ProcessTestClosedChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
  state?: ClosedChatState;
}

export class TestChatResponseDto {
  response: string;
  success: boolean;
  error?: string;
  nextState?: ClosedChatState | null;
}

@Controller('chat')
export class TestChatController {
  constructor(
    private readonly processTestOpenChatMessageUseCase: ProcessTestOpenChatMessageUseCase,
    private readonly processTestClosedChatMessageUseCase: ProcessTestClosedChatMessageUseCase,
  ) {}

  @Post('test_open')
  @HttpCode(HttpStatus.OK)
  async processTestOpenMessage(@Body() request: TestOpenChatRequestDto): Promise<TestChatResponseDto> {
    console.log('[TEST-CONTROLLER] /chat/test_open called with:', request.userId, request.message);
    const result = await this.processTestOpenChatMessageUseCase.execute(request);

    return {
      response: result.response,
      success: result.success,
      error: result.error
    };
  }

  @Post('test_closed')
  @HttpCode(HttpStatus.OK)
  async processTestClosedMessage(@Body() request: TestClosedChatRequestDto): Promise<TestChatResponseDto> {
    console.log('[TEST-CONTROLLER] /chat/test_closed called with:', request.message);
    const result = await this.processTestClosedChatMessageUseCase.execute(request);

    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }

  @Post('test_health')
  @HttpCode(HttpStatus.OK)
  async testHealth(): Promise<{ status: string; timestamp: string; mode: string }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      mode: 'TEST'
    };
  }
}