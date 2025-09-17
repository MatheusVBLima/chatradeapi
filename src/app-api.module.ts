import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './infrastructure/controllers/chat.controller';
import { HybridChatController } from './infrastructure/controllers/hybrid-chat.controller';
import { ReportController } from './infrastructure/controllers/report.controller';
import { ProcessOpenChatMessageUseCase } from './application/use-cases/process-open-chat-message.use-case';
import { ProcessClosedChatMessageUseCase } from './application/use-cases/process-closed-chat-message.use-case';
import { ProcessApiChatMessageUseCase } from './application/use-cases/process-api-chat-message.use-case';
import { ClosedChatFlow } from './domain/flows/closed-chat.flow';
import { ReportService } from './application/services/report.service';
import { ApiUserRepository } from './infrastructure/repositories/api-user.repository';
import { GeminiAIService } from './infrastructure/services/gemini-ai.service';
import { PromptService } from './infrastructure/services/prompt.service';
import { ApiClientService } from './infrastructure/services/api-client.service';
import { ApiVirtualAssistanceService } from './infrastructure/services/api-virtual-assistance.service';
import { RadeAuthService } from './infrastructure/services/rade-auth.service';
import { CacheService } from './application/services/cache.service';
import { MetricsService } from './application/services/metrics.service';
import { MetricsController } from './infrastructure/controllers/metrics.controller';

const USER_REPOSITORY = 'UserRepository';
const AI_SERVICE = 'AIService';
const VIRTUAL_ASSISTANCE_SERVICE = 'VirtualAssistanceService';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
    }),
  ],
  controllers: [AppController, ChatController, HybridChatController, ReportController, MetricsController],
  providers: [
    AppService,
    ProcessOpenChatMessageUseCase,
    ProcessClosedChatMessageUseCase,
    ProcessApiChatMessageUseCase,
    ClosedChatFlow,
    ReportService,
    CacheService,
    MetricsService,
    PromptService,
    RadeAuthService,
    ApiClientService,
    ApiVirtualAssistanceService,
    ApiUserRepository,
    {
      provide: USER_REPOSITORY,
      useClass: ApiUserRepository,
    },
    {
      provide: AI_SERVICE,
      useClass: GeminiAIService,
    },
    {
      provide: VIRTUAL_ASSISTANCE_SERVICE,
      useClass: ApiVirtualAssistanceService,
    }
  ],
})
export class AppApiModule {}