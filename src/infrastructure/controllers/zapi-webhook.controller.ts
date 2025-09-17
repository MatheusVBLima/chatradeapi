import { Controller, Post, Body, Logger, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { ZapiWebhookMessage } from '../../domain/types/zapi.types';
import { ZapiIntegrationService } from '../services/zapi-integration.service';

@Controller('zapi')
export class ZapiWebhookController {
  private readonly logger = new Logger(ZapiWebhookController.name);

  constructor(private readonly zapiIntegrationService: ZapiIntegrationService) {}

  /**
   * Webhook endpoint to receive messages from Z-API
   * This is where Z-API will send incoming WhatsApp messages
   */
  @Post('webhook/message')
  @HttpCode(HttpStatus.OK)
  async handleIncomingMessage(@Body() webhookData: ZapiWebhookMessage) {
    try {
      this.logger.log(`Received webhook from phone: ${webhookData.phone}`);
      this.logger.debug(`Message data:`, JSON.stringify(webhookData, null, 2));

      // Only process messages that are not from us (fromMe: false)
      if (webhookData.fromMe) {
        this.logger.debug('Ignoring message sent by us');
        return { status: 'ignored', reason: 'message_from_us' };
      }

      // Only process text messages for now
      if (!webhookData.text?.message) {
        this.logger.debug('Ignoring non-text message');
        return { status: 'ignored', reason: 'not_text_message' };
      }

      // Process the message through our chat integration service
      await this.zapiIntegrationService.processIncomingMessage(webhookData);

      return { status: 'success', message: 'Message processed' };
    } catch (error) {
      this.logger.error('Error processing webhook message:', error);
      
      // Still return 200 to Z-API to avoid retries
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Webhook endpoint to receive status updates from Z-API
   * This receives delivery status, read receipts, etc.
   */
  @Post('webhook/status')
  @HttpCode(HttpStatus.OK)
  async handleStatusUpdate(@Body() statusData: any) {
    try {
      this.logger.log(`Received status update:`, JSON.stringify(statusData, null, 2));
      
      // You can implement status tracking here if needed
      // For now, just acknowledge receipt
      
      return { status: 'success', message: 'Status update received' };
    } catch (error) {
      this.logger.error('Error processing status update:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Health check endpoint for Z-API webhook
   */
  @Get('health')
  async healthCheck() {
    const configStatus = this.zapiIntegrationService.getConfigurationStatus();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      webhook: 'zapi-webhook',
      configuration: configStatus,
    };
  }

  /**
   * Test endpoint to verify webhook connectivity
   * You can use this to test if Z-API can reach your server
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() testData: any) {
    this.logger.log('Test webhook called:', testData);
    
    return {
      status: 'success',
      message: 'Webhook is working',
      timestamp: new Date().toISOString(),
      receivedData: testData,
    };
  }
}