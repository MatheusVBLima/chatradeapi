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

      // Process message through test_hybrid logic directly
      const chatResponse = await this.processTestHybridMessage(
        userMessage,
        session.state,
      );

      // Update session state
      session.state = chatResponse.nextState;
      session.lastActivity = new Date();

      // Send response back via WhatsApp (skip in development)
      if (chatResponse.response) {
        if (process.env.NODE_ENV === 'production') {
          await this.twilioService.sendWhatsAppMessage(
            userPhone,
            chatResponse.response,
          );
        } else {
          console.log('[TWILIO-WEBHOOK] Would send message (dev mode):', {
            to: userPhone,
            message: chatResponse.response,
          });
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

  private async processTestHybridMessage(
    message: string,
    state: any,
  ): Promise<any> {
    try {
      // Make real HTTP call to /chat/test_hybrid endpoint
      const baseUrl =
        process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';

      console.log('[TWILIO-WEBHOOK] Calling test_hybrid with:', {
        message,
        state,
        baseUrl,
      });

      const response = await axios.post(
        `${baseUrl}/chat/test_hybrid`,
        {
          message,
          state,
          channel: 'whatsapp',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15 seconds timeout
        },
      );

      console.log('[TWILIO-WEBHOOK] test_hybrid response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[TWILIO-WEBHOOK] Error calling test_hybrid:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      // Return fallback response
      return {
        response:
          'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        success: false,
        nextState: null,
      };
    }
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
