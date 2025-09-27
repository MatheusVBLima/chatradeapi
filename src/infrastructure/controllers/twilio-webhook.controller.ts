import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TwilioService } from '../services/twilio.service';
import axios from 'axios';

interface TwilioWebhookBody {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  ProfileName?: string;
  NumMedia: string;
  [key: string]: any;
}

interface UserSession {
  state: any;
  phoneNumber: string;
  lastActivity: Date;
}

@Controller('webhook')
export class TwilioWebhookController {
  // In-memory session storage (for production, use Redis or database)
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly twilioService: TwilioService) {
    // Clean expired sessions every 10 minutes
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  @Post('twilio')
  @HttpCode(HttpStatus.OK)
  async handleTwilioWebhook(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      console.log('[TWILIO-WEBHOOK] Received webhook:', {
        from: body.From,
        to: body.To,
        body: body.Body,
        profileName: body.ProfileName,
        contentType: req.headers['content-type'],
        fullBody: body,
      });

      // Validate webhook (optional for development, recommended for production)
      const isValid = this.validateWebhook(signature, req, body);
      if (!isValid && process.env.NODE_ENV === 'production') {
        console.warn('[TWILIO-WEBHOOK] Invalid webhook signature');
        res.status(403).send('Forbidden');
        return;
      }

      const messageData = this.twilioService.extractMessageData(body);
      const userPhone = messageData.from; // e.g., "whatsapp:+5511999999999"
      const userMessage = messageData.body;

      if (!userMessage.trim()) {
        console.log('[TWILIO-WEBHOOK] Empty message received, ignoring');
        res.status(200).send('OK');
        return;
      }

      // Get or create user session
      const session = this.getOrCreateSession(userPhone);

      // Process message through test_hybrid logic directly (temporarily using mock)
      const chatResponse = await this.mockTestHybridResponse(
        userMessage,
        session.state,
      );

      // Update session state
      session.state = chatResponse.nextState;
      session.lastActivity = new Date();

      // Send response back via WhatsApp
      if (chatResponse.response) {
        try {
          await this.twilioService.sendWhatsAppMessage(
            userPhone,
            chatResponse.response,
          );
          console.log(
            '[TWILIO-WEBHOOK] Message sent successfully to:',
            userPhone,
          );
        } catch (error) {
          console.error('[TWILIO-WEBHOOK] Error sending message:', error);
        }
      }

      console.log('[TWILIO-WEBHOOK] Message processed successfully');
      res.status(200).send('OK');
    } catch (error) {
      console.error('[TWILIO-WEBHOOK] Error processing webhook:', error);

      // Send error message to user
      try {
        await this.twilioService.sendWhatsAppMessage(
          body.From,
          'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        );
      } catch (sendError) {
        console.error(
          '[TWILIO-WEBHOOK] Error sending error message:',
          sendError,
        );
      }

      res.status(500).send('Internal Server Error');
    }
  }

  private validateWebhook(signature: string, req: Request, body: any): boolean {
    if (!signature) {
      console.warn('[TWILIO-WEBHOOK] No signature provided');
      return false;
    }

    try {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      return this.twilioService.validateWebhook(signature, url, body);
    } catch (error) {
      console.error('[TWILIO-WEBHOOK] Signature validation error:', error);
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
    console.log(`[TWILIO-WEBHOOK] Created new session for ${phoneNumber}`);

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
      console.log(`[TWILIO-WEBHOOK] Cleaned ${cleanedCount} expired sessions`);
    }
  }

  private async mockTestHybridResponse(
    message: string,
    state: any,
  ): Promise<any> {
    console.log('[TWILIO-WEBHOOK] Processing message with mock logic:', {
      message,
      state: state?.currentState || 'START',
    });

    // Simple mock logic for testing
    if (!state) {
      return {
        response:
          '[TESTE] Olá! Bem-vindo ao atendimento RADE! Para começar, me diga qual seu perfil:\n\n1 - Sou Estudante\n2 - Sou Coordenador\n3 - Ainda não sou usuário',
        success: true,
        nextState: {
          currentState: 'AWAITING_USER_TYPE',
          data: {},
        },
      };
    }

    if (state.currentState === 'AWAITING_USER_TYPE') {
      if (message === '1') {
        return {
          response:
            'Entendido. Para continuar, por favor, informe seu CPF (apenas números).',
          success: true,
          nextState: {
            currentState: 'AWAITING_STUDENT_CPF',
            data: { userType: 'student' },
          },
        };
      }
    }

    // Default response
    return {
      response: `[TESTE] Você disse: "${message}". Digite "1" para começar.`,
      success: true,
      nextState: state,
    };
  }

  // Simple test endpoint
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async test(@Body() body: any): Promise<any> {
    console.log('[TWILIO-WEBHOOK] Test endpoint called with:', body);
    return {
      status: 'OK',
      message: 'Test endpoint working',
      receivedBody: body,
      timestamp: new Date().toISOString(),
    };
  }

  // Direct test message endpoint
  @Post('send-test')
  @HttpCode(HttpStatus.OK)
  async sendTestMessage(): Promise<any> {
    console.log('[TWILIO-WEBHOOK] Direct test message endpoint called');

    try {
      const result = await this.twilioService.sendWhatsAppMessage(
        'whatsapp:+5581996364880',
        '🧪 TESTE DIRETO: Se você receber esta mensagem, a integração está funcionando! Responda "ok" para confirmar.',
      );
      console.log('[TWILIO-WEBHOOK] Direct test message sent:', result.sid);
      return {
        success: true,
        message: 'Test message sent successfully',
        sid: result.sid,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[TWILIO-WEBHOOK] Direct test failed:', error);
      return {
        success: false,
        error: 'Test failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Health check endpoint
  @Post('health')
  @HttpCode(HttpStatus.OK)
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
