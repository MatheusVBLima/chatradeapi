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

@Controller('webhook')
export class ZapiWebhookController {
  // In-memory session storage (for production, use Redis or database)
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly zapiService: ZapiService) {
    // Clean expired sessions every 10 minutes
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  @Post('zapi')
  @HttpCode(HttpStatus.OK)
  async handleZapiWebhook(
    @Body() body: any,
    @Headers('x-zapi-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      console.log('[ZAPI-WEBHOOK] Received webhook:', {
        phone: body.phone,
        text: body.text || body.message || body.body,
        fullBody: body,
      });

      // Validate webhook (if Z-API provides signature validation)
      const isValid = this.validateWebhook(signature, req, body);
      if (!isValid && process.env.NODE_ENV === 'production') {
        console.warn('[ZAPI-WEBHOOK] Invalid webhook signature');
        res.status(403).send('Forbidden');
        return;
      }

      const messageData = this.zapiService.extractMessageData(body);
      const userPhone = messageData.from; // e.g., "whatsapp:+5511999999999"
      const userMessage = messageData.body;

      if (!userMessage.trim()) {
        console.log('[ZAPI-WEBHOOK] Empty message received, ignoring');
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
          console.log('[ZAPI-WEBHOOK] About to send message to:', userPhone);

          await this.zapiService.sendWhatsAppMessage(
            userPhone,
            chatResponse.response,
          );

          console.log(
            '[ZAPI-WEBHOOK] Message sent successfully to:',
            userPhone,
          );
        } catch (error) {
          console.error('[ZAPI-WEBHOOK] Error sending message:', error);
        }
      }

      console.log('[ZAPI-WEBHOOK] Message processed successfully');
      res.status(200).send('OK');
    } catch (error) {
      console.error('[ZAPI-WEBHOOK] Error processing webhook:', error);

      // Send error message to user
      try {
        await this.zapiService.sendWhatsAppMessage(
          body.phone ? `whatsapp:+${body.phone}` : 'whatsapp:+unknown',
          'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        );
      } catch (sendError) {
        console.error('[ZAPI-WEBHOOK] Error sending error message:', sendError);
      }

      res.status(500).send('Internal Server Error');
    }
  }

  private validateWebhook(signature: string, req: Request, body: any): boolean {
    if (!signature) {
      console.warn('[ZAPI-WEBHOOK] No signature provided');
      return true; // Z-API may not use signature validation
    }

    try {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      return this.zapiService.validateWebhook(signature, url, body);
    } catch (error) {
      console.error('[ZAPI-WEBHOOK] Signature validation error:', error);
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
    console.log(`[ZAPI-WEBHOOK] Created new session for ${phoneNumber}`);

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
      console.log(`[ZAPI-WEBHOOK] Cleaned ${cleanedCount} expired sessions`);
    }
  }

  private async callTestHybridEndpoint(
    message: string,
    state: any,
  ): Promise<any> {
    console.log('[ZAPI-WEBHOOK] Calling real test_hybrid endpoint:', {
      message,
      state: state?.currentState || 'START',
    });

    try {
      // Call internal test_hybrid endpoint
      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
        message: message,
        state: state,
        channel: 'whatsapp',
      });

      console.log('[ZAPI-WEBHOOK] test_hybrid response:', {
        success: response.data.success,
        hasResponse: !!response.data.response,
        nextState: response.data.nextState?.currentState,
      });

      return response.data;
    } catch (error) {
      console.error('[ZAPI-WEBHOOK] Error calling test_hybrid:', error.response?.data || error.message);

      // Fallback response em caso de erro
      return {
        response: 'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        success: false,
        nextState: state || null,
      };
    }
  }

  // Health check endpoint
  @Post('zapi-health')
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
