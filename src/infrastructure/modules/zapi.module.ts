import { Module } from '@nestjs/common';
import { ZapiService } from '../services/zapi.service';
import { ZapiIntegrationService } from '../services/zapi-integration.service';
import { ZapiWebhookController } from '../controllers/zapi-webhook.controller';
import { RadeAuthService } from '../services/rade-auth.service';
import { ApiClientService } from '../services/api-client.service';
import { SessionCacheService } from '../../application/services/session-cache.service';

@Module({
  controllers: [ZapiWebhookController],
  providers: [
    ZapiService,
    ZapiIntegrationService,
    RadeAuthService,
    ApiClientService,
    SessionCacheService,
  ],
  exports: [
    ZapiService,
    ZapiIntegrationService,
    RadeAuthService,
    ApiClientService,
    SessionCacheService,
  ],
})
export class ZapiModule {}