import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ZapiService } from '../services/zapi.service';
import axios from 'axios';

interface ZapiWebhookBody {
  phone: string;
  text?: string;
  message?: string;
  body?: string;
  instanceId?: string;
  [key: string]: any;
}

interface UserSession {
  state: any;
  phoneNumber: string;
  lastActivity: Date;
}

@ApiTags('webhook')
@Controller('webhook')
@SkipThrottle() // Webhooks should never be rate limited
export class ZapiWebhookController {
  private readonly logger = new Logger(ZapiWebhookController.name);

  // In-memory session storage (for production, use Redis or database)
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly zapiService: ZapiService,
    private readonly configService: ConfigService,
  ) {
    // Clean expired sessions every 10 minutes
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  @Post('zapi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook do Z-API para mensagens WhatsApp',
    description: `Recebe webhooks do Z-API quando usuários enviam mensagens via WhatsApp.

O fluxo é:
1. Z-API envia webhook com dados da mensagem
2. Sistema valida assinatura (em produção)
3. Extrai dados da mensagem
4. Busca ou cria sessão do usuário
5. Processa mensagem através do endpoint /chat/test_hybrid
6. Envia resposta de volta para o usuário via WhatsApp

Este endpoint gerencia sessões em memória para manter contexto entre mensagens (timeout: 30min).`,
  })
  @ApiHeader({
    name: 'x-zapi-signature',
    description: 'Assinatura do webhook para validação',
    required: false,
  })
  @ApiBody({
    description: 'Payload do webhook Z-API',
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '5511999999999' },
        text: { type: 'string', example: 'Olá' },
        message: { type: 'string', example: 'Olá' },
        body: { type: 'string', example: 'Olá' },
        instanceId: { type: 'string', example: 'instance-123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processado com sucesso',
    schema: { type: 'string', example: 'OK' },
  })
  @ApiResponse({
    status: 403,
    description: 'Assinatura inválida (apenas em produção)',
    schema: { type: 'string', example: 'Forbidden' },
  })
  @ApiResponse({
    status: 500,
    description: 'Erro ao processar webhook',
    schema: { type: 'string', example: 'Internal Server Error' },
  })
  async handleZapiWebhook(
    @Body() body: any,
    @Headers('x-zapi-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(
        `Received webhook: phone=${body.phone}, text=${body.text || body.message || body.body}`,
      );

      // Validate webhook (if Z-API provides signature validation)
      const isValid = this.validateWebhook(signature, req, body);
      if (!isValid && process.env.NODE_ENV === 'production') {
        this.logger.warn('Invalid webhook signature');
        res.status(403).send('Forbidden');
        return;
      }

      const messageData = this.zapiService.extractMessageData(body);
      const userPhone = messageData.from; // e.g., "whatsapp:+5511999999999"
      const userMessage = messageData.body;

      if (!userMessage.trim()) {
        this.logger.log('Empty message received, ignoring');
        res.status(200).send('OK');
        return;
      }

      // Get or create user session
      const session = this.getOrCreateSession(userPhone);

      // Process message through REAL test_hybrid endpoint
      const chatResponse = await this.callTestHybridEndpoint(
        userMessage,
        session.state,
      );

      // Update session state
      session.state = chatResponse.nextState;
      session.lastActivity = new Date();

      // Send response back via WhatsApp
      if (chatResponse.response) {
        try {
          this.logger.log(`About to send message to: ${userPhone}`);

          await this.zapiService.sendWhatsAppMessage(
            userPhone,
            chatResponse.response,
          );

          this.logger.log(`Message sent successfully to: ${userPhone}`);
        } catch (error) {
          this.logger.error('Error sending message:', error);
        }
      }

      this.logger.log('Message processed successfully');
      res.status(200).send('OK');
    } catch (error) {
      this.logger.error('Error processing webhook:', error);

      // Send error message to user
      try {
        await this.zapiService.sendWhatsAppMessage(
          body.phone ? `whatsapp:+${body.phone}` : 'whatsapp:+unknown',
          'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        );
      } catch (sendError) {
        this.logger.error('Error sending error message:', sendError);
      }

      res.status(500).send('Internal Server Error');
    }
  }

  private validateWebhook(signature: string, req: Request, body: any): boolean {
    if (!signature) {
      this.logger.warn('No signature provided');
      return true; // Z-API may not use signature validation
    }

    try {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      return this.zapiService.validateWebhook(signature, url, body);
    } catch (error) {
      this.logger.error('Signature validation error:', error);
      return false;
    }
  }

  private getOrCreateSession(phoneNumber: string): UserSession {
    const existingSession = this.sessions.get(phoneNumber);

    if (existingSession && !this.isSessionExpired(existingSession)) {
      return existingSession;
    }

    // Create new session
    const newSession: UserSession = {
      state: null, // Start with null state for test_hybrid
      phoneNumber,
      lastActivity: new Date(),
    };

    this.sessions.set(phoneNumber, newSession);
    this.logger.log(`Created new session for ${phoneNumber}`);

    return newSession;
  }

  private isSessionExpired(session: UserSession): boolean {
    const now = new Date().getTime();
    const sessionTime = session.lastActivity.getTime();
    return now - sessionTime > this.SESSION_TIMEOUT;
  }

  private cleanExpiredSessions(): void {
    const now = new Date().getTime();
    let cleanedCount = 0;

    for (const [phoneNumber, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(phoneNumber);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned ${cleanedCount} expired sessions`);
    }
  }

  private async callTestHybridEndpoint(
    message: string,
    state: any,
  ): Promise<any> {
    this.logger.log(
      `Calling test_hybrid endpoint: message="${message}", state=${state?.currentState || 'START'}`,
    );

    try {
      // WhatsApp sempre usa 'mobile' como padrão (comunicação via telefone)
      const chatEnvironment = 'mobile';

      this.logger.log(`Using WhatsApp environment: ${chatEnvironment}`);

      // Call internal hybrid endpoint (production)
      const baseUrl = this.configService.get<string>(
        'BASE_URL',
        'http://localhost:3001',
      );
      const chatEndpoint = this.configService.get<string>(
        'WEBHOOK_CHAT_ENDPOINT',
        '/chat/hybrid',
      );
      const response = await axios.post(`${baseUrl}${chatEndpoint}`, {
        message: message,
        state: state,
        environment: chatEnvironment,
      });

      this.logger.log(
        `test_hybrid response: success=${response.data.success}, nextState=${response.data.nextState?.currentState}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        'Error calling test_hybrid:',
        error.response?.data || error.message,
      );

      // Fallback response em caso de erro
      return {
        response:
          'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        success: false,
        nextState: state || null,
      };
    }
  }

  @Post('zapi-health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check do webhook Z-API',
    description:
      'Verifica se o sistema de webhooks está funcionando e retorna número de sessões ativas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status do webhook',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        timestamp: { type: 'string', example: '2025-10-02T19:00:00.000Z' },
        sessions: { type: 'number', example: 5 },
      },
    },
  })
  async health(): Promise<{
    status: string;
    timestamp: string;
    sessions: number;
  }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      sessions: this.sessions.size,
    };
  }
}
