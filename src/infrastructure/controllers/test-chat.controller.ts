import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  ProcessTestOpenChatMessageUseCase,
  ProcessTestOpenChatMessageRequest,
} from '../../application/use-cases/process-test-open-chat-message.use-case';
import {
  ProcessTestClosedChatMessageUseCase,
  ProcessTestClosedChatMessageRequest,
} from '../../application/use-cases/process-test-closed-chat-message.use-case';
import { ProcessApiChatMessageUseCase } from '../../application/use-cases/process-api-chat-message.use-case';
import {
  TestOpenChatRequestDto,
  TestClosedChatRequestDto,
  TestChatResponseDto,
  OpenChatRequestDto,
  ChatResponseDto,
} from '../dto';

@ApiTags('chat')
@Controller('chat')
export class TestChatController {
  private readonly logger = new Logger(TestChatController.name);
  constructor(
    private readonly processTestOpenChatMessageUseCase: ProcessTestOpenChatMessageUseCase,
    private readonly processTestClosedChatMessageUseCase: ProcessTestClosedChatMessageUseCase,
    private readonly processApiChatMessageUseCase: ProcessApiChatMessageUseCase,
  ) {}

  @Post('test_open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[TESTE] Chat aberto com IA',
    description: `Endpoint de teste para chat aberto. Pode usar dados mockados OU API staging dependendo da configuração de ambiente.

Útil para desenvolvimento e testes sem afetar dados de produção.
Funciona de forma similar ao /chat/open, mas em ambiente de teste.`,
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
  async processTestOpenMessage(
    @Body() request: TestOpenChatRequestDto,
  ): Promise<TestChatResponseDto> {
    this.logger.log(`[TEST] /test/open called - message: ${request.message}`);
    const result =
      await this.processTestOpenChatMessageUseCase.execute(request);

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
    summary: '[TESTE] Chat fechado com menu',
    description: `Endpoint de teste para chat fechado (menu estruturado). Pode usar dados mockados OU API staging dependendo da configuração de ambiente.

Útil para testar fluxos de menu sem afetar dados de produção.
Funciona de forma similar ao /chat/closed, mas em ambiente de teste.`,
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
  async processTestClosedMessage(
    @Body() request: TestClosedChatRequestDto,
  ): Promise<TestChatResponseDto> {
    this.logger.log(`[TEST] /test/closed called - message: ${request.message}`);
    const result =
      await this.processTestClosedChatMessageUseCase.execute(request);

    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }

  @Post('test_api')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[TESTE] Validar conectividade com API RADE',
    description: `Endpoint de teste para validar conectividade e autenticação com a API RADE.

Útil para testar se o token e configurações estão corretos antes de usar em produção.
Faz chamadas diretas à API RADE usando as credenciais configuradas no ambiente.`,
  })
  @ApiBody({ type: OpenChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta da API RADE',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido (30 requisições por minuto)',
  })
  async processTestApiMessage(
    @Body() request: OpenChatRequestDto,
  ): Promise<ChatResponseDto> {
    this.logger.log(
      `[TEST] /test/api called - userId: ${request.userId}, message: ${request.message}`,
    );

    const result = await this.processApiChatMessageUseCase.execute(
      request.message,
      request.userId || '',
    );

    this.logger.log(
      `[TEST] Result: success=${result.success}, response length=${result.response.length}`,
    );

    return {
      response: result.response,
      success: result.success,
    };
  }

  @Post('test_health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[TESTE] Health check de teste',
    description:
      'Verifica se os endpoints de teste estão funcionando. Retorna status OK se tudo estiver operacional.',
  })
  @ApiResponse({
    status: 200,
    description: 'Endpoints de teste funcionando',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        timestamp: { type: 'string', example: '2025-10-02T18:50:00.000Z' },
        mode: { type: 'string', example: 'test' },
      },
    },
  })
  async testHealth(): Promise<{
    status: string;
    timestamp: string;
    mode: string;
  }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      mode: 'test',
    };
  }
}
