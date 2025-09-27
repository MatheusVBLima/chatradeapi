import { Module } from '@nestjs/common';
import { ZapiService } from '../services/zapi.service';
import { ZapiWebhookController } from '../controllers/zapi-webhook.controller';

@Module({
  providers: [ZapiService],
  controllers: [ZapiWebhookController],
  exports: [ZapiService],
})
export class ZapiModule {}
