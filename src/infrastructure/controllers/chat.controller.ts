import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ProcessOpenChatMessageUseCase } from '../../application/use-cases/process-open-chat-message.use-case';
import { ProcessClosedChatMessageUseCase } from '../../application/use-cases/process-closed-chat-message.use-case';
import {
  OpenChatRequestDto,
  ClosedChatRequestDto,
  ChatResponseDto,
} from '../dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly processOpenChatMessageUseCase: ProcessOpenChatMessageUseCase,
    private readonly processClosedChatMessageUseCase: ProcessClosedChatMessageUseCase,
  ) {}

  @Post('open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat aberto com IA',
    description:
      'Conversa livre com IA usando Google Gemini. Suporta function calling para buscar dados do usuário, atividades, professores, etc.',
  })
  @ApiBody({ type: OpenChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta do chatbot',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Requisição inválida',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido (30 requisições por minuto)',
  })
  async processOpenMessage(
    @Body() request: OpenChatRequestDto,
  ): Promise<ChatResponseDto> {
    this.logger.log(
      `[PROD] /chat/open called - userId: ${request.userId}, message: ${request.message}, state: ${request.state?.currentState || 'null'}`,
    );
    const result = await this.processOpenChatMessageUseCase.execute(request);

    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }

  @Post('closed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat guiado por fluxo',
    description:
      'Conversa estruturada com menu de opções. Não usa IA, segue fluxo pré-definido.',
  })
  @ApiBody({ type: ClosedChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta do chatbot com próximo estado',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Requisição inválida',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido (30 requisições por minuto)',
  })
  async processClosedMessage(
    @Body() request: ClosedChatRequestDto,
  ): Promise<ChatResponseDto> {
    this.logger.log(`[PROD] /chat/closed called - message: ${request.message}`);
    const result = await this.processClosedChatMessageUseCase.execute(request);

    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }

  @Post('health')
  @SkipThrottle() // Health checks should never be rate limited
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check do chat',
    description:
      'Verifica se os endpoints de chat estão funcionando. Sem rate limit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Serviço funcionando',
    schema: {
      properties: {
        status: { type: 'string', example: 'OK' },
        timestamp: { type: 'string', example: '2025-10-02T10:00:00.000Z' },
      },
    },
  })
  async health(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }
}
