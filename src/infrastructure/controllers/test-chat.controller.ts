import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  ProcessTestOpenChatMessageUseCase,
  ProcessTestOpenChatMessageRequest
} from '../../application/use-cases/process-test-open-chat-message.use-case';
import {
  ProcessTestClosedChatMessageUseCase,
  ProcessTestClosedChatMessageRequest
} from '../../application/use-cases/process-test-closed-chat-message.use-case';
import { TestOpenChatRequestDto, TestClosedChatRequestDto, TestChatResponseDto } from '../dto';

@ApiTags('chat')
@Controller('chat')
export class TestChatController {
  private readonly logger = new Logger(TestChatController.name);
  constructor(
    private readonly processTestOpenChatMessageUseCase: ProcessTestOpenChatMessageUseCase,
    private readonly processTestClosedChatMessageUseCase: ProcessTestClosedChatMessageUseCase,
  ) {}

  @Post('test_open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test: Chat aberto com IA (Mock Data)',
    description: `Endpoint de teste para chat aberto que usa dados mockados em vez da API RADE.

Útil para desenvolvimento e testes sem precisar de acesso à API real.
Funciona de forma similar ao /chat/open, mas com dados simulados.`,
  })
  @ApiBody({ type: TestOpenChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta do chatbot de teste',
    type: TestChatResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido (30 requisições por minuto)',
  })
  async processTestOpenMessage(@Body() request: TestOpenChatRequestDto): Promise<TestChatResponseDto> {
    this.logger.log(`/chat/test_open called - message: ${request.message}`);
    const result = await this.processTestOpenChatMessageUseCase.execute(request);

    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }

  @Post('test_closed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test: Chat fechado com menu (Mock Data)',
    description: `Endpoint de teste para chat fechado (menu estruturado) que usa dados mockados.

Útil para testar fluxos de menu sem acessar a API real.
Funciona de forma similar ao /chat/closed, mas com dados simulados.`,
  })
  @ApiBody({ type: TestClosedChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta do chatbot de teste',
    type: TestChatResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido (30 requisições por minuto)',
  })
  async processTestClosedMessage(@Body() request: TestClosedChatRequestDto): Promise<TestChatResponseDto> {
    this.logger.log(`/chat/test_closed called - message: ${request.message}`);
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
  @ApiOperation({
    summary: 'Test: Health check de teste',
    description: 'Verifica se os endpoints de teste estão funcionando. Retorna status OK se tudo estiver operacional.',
  })
  @ApiResponse({
    status: 200,
    description: 'Endpoints de teste funcionando',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        timestamp: { type: 'string', example: '2025-10-02T18:50:00.000Z' },
        mode: { type: 'string', example: 'TEST' },
      },
    },
  })
  async testHealth(): Promise<{ status: string; timestamp: string; mode: string }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      mode: 'TEST'
    };
  }
}