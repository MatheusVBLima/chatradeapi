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

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  async sendWhatsAppMessage(to: string, body: string): Promise<any> {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Check your credentials.');
    }

    try {
      // Ensure the 'to' number has the whatsapp: prefix
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

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
