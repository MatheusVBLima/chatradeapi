import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ZapiService {
  private readonly instanceId: string;
  private readonly token: string;
  private readonly clientToken: string;
  private readonly baseUrl: string;

  constructor() {
    this.instanceId = process.env.ZAPI_INSTANCE_ID || '';
    this.token = process.env.ZAPI_TOKEN || '';
    this.clientToken = process.env.ZAPI_CLIENT_TOKEN || '';
    this.baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}`;

    console.log('[ZAPI-SERVICE] Constructor called with:', {
      instanceId: this.instanceId
        ? `${this.instanceId.substring(0, 8)}...`
        : 'MISSING',
      token: this.token ? `${this.token.substring(0, 8)}...` : 'MISSING',
      clientToken: this.clientToken ? `${this.clientToken.substring(0, 8)}...` : 'MISSING',
      baseUrl: this.baseUrl,
    });
  }

  async sendWhatsAppMessage(to: string, message: string): Promise<any> {
    console.log('[ZAPI-SERVICE] Attempting to send message:', {
      to,
      messageLength: message.length,
    });

    try {
      // Remove 'whatsapp:' prefix if present and format phone number
      const formattedPhone = to.replace('whatsapp:', '').replace('+', '');

      console.log('[ZAPI-SERVICE] Sending message with formatted phone:', {
        original: to,
        formatted: formattedPhone,
      });

      // Standard headers for Z-API requests with client token
      const headers = {
        'Content-Type': 'application/json',
        'Client-Token': this.clientToken,
      };

      console.log('[ZAPI-SERVICE] Sending with headers:', headers);


      const response = await axios.post(
        `${this.baseUrl}/send-text`,
        {
          phone: formattedPhone,
          message: message,
        },
        { headers }
      );

      console.log('[ZAPI] Message sent successfully:', {
        status: response.status,
        data: response.data,
      });

      return response.data;
    } catch (error) {
      console.error(
        '[ZAPI] Error sending message:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Extract message data from Z-API webhook
  extractMessageData(body: any): { from: string; body: string; to: string } {
    console.log('[ZAPI-SERVICE] Extracting message data from webhook:', body);

    // Z-API webhook format - text can be object or string
    let messageText = '';
    if (body.text) {
      if (typeof body.text === 'object' && body.text.message) {
        messageText = body.text.message;
      } else if (typeof body.text === 'string') {
        messageText = body.text;
      }
    } else {
      messageText = body.message || body.body || '';
    }

    return {
      from: `whatsapp:+${body.phone || body.from}`, // Normalize to whatsapp: format
      body: messageText,
      to: body.instanceId
        ? `whatsapp:+${body.instanceId}`
        : 'whatsapp:+unknown',
    };
  }

  // Validate Z-API webhook (if they provide signature validation)
  validateWebhook(signature: string, url: string, body: any): boolean {
    // Z-API may not have signature validation like Twilio
    // This would depend on their security implementation
    console.log(
      '[ZAPI-SERVICE] Webhook validation called (may not be implemented)',
    );
    return true; // For now, always return true
  }

  // Check if service is properly configured
  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }
}
