import { Controller, Post, Body, HttpCode, HttpStatus, Delete, Param } from '@nestjs/common';
import {
  ProcessOpenChatMessageUseCase,
  ProcessOpenChatMessageRequest
} from '../../application/use-cases/process-open-chat-message.use-case';
import {
  ProcessClosedChatMessageUseCase,
  ProcessClosedChatMessageRequest
} from '../../application/use-cases/process-closed-chat-message.use-case';
import { ChatEnvironment } from '../../domain/enums/chat-environment.enum';

// DTO for open chat
export class OpenChatRequestDto implements ProcessOpenChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  environment: ChatEnvironment;
}

// DTO for closed chat
export class ClosedChatRequestDto implements ProcessClosedChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  environment: ChatEnvironment;
  currentState?: any;
}

@Controller('chat')
export class MockChatController {
  constructor(
    private readonly processOpenChatMessageUseCase: ProcessOpenChatMessageUseCase,
    private readonly processClosedChatMessageUseCase: ProcessClosedChatMessageUseCase,
  ) {}

  @Post('open')
  @HttpCode(HttpStatus.OK)
  async processOpenMessage(@Body() request: OpenChatRequestDto) {
    return this.processOpenChatMessageUseCase.execute(request);
  }

  @Post('closed')
  @HttpCode(HttpStatus.OK)
  async processClosedMessage(@Body() request: ClosedChatRequestDto) {
    return this.processClosedChatMessageUseCase.execute(request);
  }
}