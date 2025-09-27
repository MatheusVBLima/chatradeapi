import { Injectable } from '@nestjs/common';
import * as twilio from 'twilio';

@Injectable()
export class TwilioService {
  private client: twilio.Twilio;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly whatsappNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.whatsappNumber =
      process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Sandbox number

    console.log('[TWILIO-SERVICE] Constructor called with:', {
      accountSid: this.accountSid
        ? `${this.accountSid.substring(0, 8)}...`
        : 'MISSING',
      authToken: this.authToken
        ? `${this.authToken.substring(0, 8)}...`
        : 'MISSING',
      whatsappNumber: this.whatsappNumber,
    });

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
      console.log('[TWILIO-SERVICE] Client initialized successfully');
    } else {
      console.error(
        '[TWILIO-SERVICE] Missing credentials - client not initialized',
      );
    }
  }

  async sendWhatsAppMessage(to: string, body: string): Promise<any> {
    console.log('[TWILIO-SERVICE] Attempting to send message:', {
      to,
      from: this.whatsappNumber,
      bodyLength: body.length,
      hasClient: !!this.client,
    });

    if (!this.client) {
      throw new Error('Twilio client not initialized. Check your credentials.');
    }

    try {
      // Ensure the 'to' number has the whatsapp: prefix
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      console.log('[TWILIO-SERVICE] Sending message with formatted params:', {
        from: this.whatsappNumber,
        to: formattedTo,
      });

      const message = await this.client.messages.create({
        from: this.whatsappNumber,
        to: formattedTo,
        body: body,
      });

      console.log(`[TWILIO] Message sent successfully: ${message.sid}`);
      return message;
    } catch (error) {
      console.error('[TWILIO] Error sending message:', error);
      throw error;
    }
  }

  validateWebhook(signature: string, url: string, params: any): boolean {
    if (!this.authToken) {
      console.warn('[TWILIO] Auth token not available for webhook validation');
      return false;
    }

    try {
      return twilio.validateRequest(this.authToken, signature, url, params);
    } catch (error) {
      console.error('[TWILIO] Webhook validation error:', error);
      return false;
    }
  }

  extractMessageData(body: any) {
    return {
      from: body.From || '',
      to: body.To || '',
      body: body.Body || '',
      profileName: body.ProfileName || '',
      accountSid: body.AccountSid || '',
      messageSid: body.MessageSid || '',
      numMedia: parseInt(body.NumMedia) || 0,
    };
  }
}
