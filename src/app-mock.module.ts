import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MockChatController } from './infrastructure/controllers/mock-chat.controller';
import { ReportController } from './infrastructure/controllers/report.controller';
import { ProcessOpenChatMessageUseCase } from './application/use-cases/process-open-chat-message.use-case';
import { ProcessClosedChatMessageUseCase } from './application/use-cases/process-closed-chat-message.use-case';
// ProcessApiChatMessageUseCase removed - it's API-specific
import { ClosedChatFlow } from './domain/flows/closed-chat.flow';
import { ReportService } from './application/services/report.service';
import { MockUserRepository } from './infrastructure/repositories/mock-user.repository';
import { GeminiAIService } from './infrastructure/services/gemini-ai.service';
import { PromptService } from './infrastructure/services/prompt.service';
import { MockVirtualAssistanceService } from './infrastructure/services/mock-virtual-assistance.service';
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
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, MockChatController, ReportController, MetricsController],
  providers: [
    AppService,
    ProcessOpenChatMessageUseCase,
    ProcessClosedChatMessageUseCase,
    // ProcessApiChatMessageUseCase removed - API-specific
    ClosedChatFlow,
    ReportService,
    CacheService,
    MetricsService,
    PromptService,
    MockVirtualAssistanceService,
    MockUserRepository,
    {
      provide: USER_REPOSITORY,
      useClass: MockUserRepository,
    },
    {
      provide: AI_SERVICE,
      useClass: GeminiAIService,
    },
    {
      provide: VIRTUAL_ASSISTANCE_SERVICE,
      useClass: MockVirtualAssistanceService,
    }
  ],
})
export class AppMockModule {}