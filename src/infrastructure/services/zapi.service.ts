import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  ZapiConfig,
  ZapiSendTextRequest,
  ZapiSendTextResponse,
  ZapiInstanceInfo,
  ZapiContactInfo,
} from '../../domain/types/zapi.types';

@Injectable()
export class ZapiService {
  private readonly logger = new Logger(ZapiService.name);
  private readonly client: AxiosInstance;
  private readonly config: ZapiConfig;

  constructor() {
    this.config = {
      instanceId: process.env.ZAPI_INSTANCE_ID || '',
      token: process.env.ZAPI_TOKEN || '',
      clientToken: process.env.ZAPI_CLIENT_TOKEN || '',
      baseUrl: process.env.ZAPI_BASE_URL || 'https://api.z-api.io',
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Z-API Service initialized for instance: ${this.config.instanceId}`);
  }

  /**
   * Send text message via Z-API
   */
  async sendTextMessage(phone: string, message: string): Promise<ZapiSendTextResponse> {
    try {
      const payload: ZapiSendTextRequest = {
        phone: this.normalizePhone(phone),
        message,
      };

      this.logger.debug(`Sending message to ${phone}: ${message.substring(0, 50)}...`);

      const response = await this.client.post(
        `/instances/${this.config.instanceId}/token/${this.config.token}/send-text`,
        payload
      );

      this.logger.log(`Message sent successfully to ${phone}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to send message to ${phone}:`, error.message);
      throw new Error(`Z-API send message failed: ${error.message}`);
    }
  }

  /**
   * Get instance information
   */
  async getInstanceInfo(): Promise<ZapiInstanceInfo> {
    try {
      const response = await this.client.get(
        `/instances/${this.config.instanceId}/token/${this.config.token}/status`
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get instance info:', error.message);
      throw new Error(`Z-API get instance info failed: ${error.message}`);
    }
  }

  /**
   * Get contact information
   */
  async getContactInfo(phone: string): Promise<ZapiContactInfo> {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      
      const response = await this.client.get(
        `/instances/${this.config.instanceId}/token/${this.config.token}/contacts/${normalizedPhone}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get contact info for ${phone}:`, error.message);
      throw new Error(`Z-API get contact info failed: ${error.message}`);
    }
  }

  /**
   * Check if Z-API is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.instanceId && this.config.token);
  }

  /**
   * Validate client token if provided
   */
  validateClientToken(providedToken?: string): boolean {
    if (!this.config.clientToken) {
      return true; // No client token configured, skip validation
    }
    return this.config.clientToken === providedToken;
  }

  /**
   * Get configuration status for health check
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      instanceId: this.config.instanceId ? `${this.config.instanceId.substring(0, 8)}...` : 'not set',
      hasToken: !!this.config.token,
      hasClientToken: !!this.config.clientToken,
      baseUrl: this.config.baseUrl,
    };
  }

  /**
   * Normalize phone number format
   * Remove all non-digits and ensure proper format
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If starts with 55 (Brazil code), return as is
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      return cleaned;
    }
    
    // If it's a Brazilian number without country code, add 55
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      return `55${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Format phone number for display
   */
  formatPhoneForDisplay(phone: string): string {
    const normalized = this.normalizePhone(phone);
    
    if (normalized.startsWith('55') && normalized.length >= 12) {
      // Format: +55 (11) 99999-9999
      const countryCode = normalized.substring(0, 2);
      const areaCode = normalized.substring(2, 4);
      const firstPart = normalized.substring(4, 9);
      const secondPart = normalized.substring(9);
      
      return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
    }
    
    return phone;
  }

  /**
   * Validate if phone number is valid Brazilian format
   */
  isValidBrazilianPhone(phone: string): boolean {
    const normalized = this.normalizePhone(phone);
    
    // Brazilian mobile: +55 11 9XXXX-XXXX (13 digits total)
    // Brazilian landline: +55 11 XXXX-XXXX (12 digits total)
    return normalized.startsWith('55') && (normalized.length === 12 || normalized.length === 13);
  }
}