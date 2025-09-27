import { Module } from '@nestjs/common';
import { TwilioService } from '../services/twilio.service';
import { TwilioWebhookController } from '../controllers/twilio-webhook.controller';

@Module({
  providers: [TwilioService],
  controllers: [TwilioWebhookController],
  exports: [TwilioService],
})
export class TwilioModule {}
