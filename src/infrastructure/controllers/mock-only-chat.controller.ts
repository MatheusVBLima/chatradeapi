import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessOpenChatMessageUseCase } from '../../application/use-cases/process-open-chat-message.use-case';
import { ProcessClosedChatMessageUseCase } from '../../application/use-cases/process-closed-chat-message.use-case';
import { MockVirtualAssistanceService } from '../services/mock-virtual-assistance.service';
import { MockUserRepository } from '../repositories/mock-user.repository';
import { GeminiAIService } from '../services/gemini-ai.service';
import { PromptService } from '../services/prompt.service';
import { CacheService } from '../../application/services/cache.service';
import { MetricsService } from '../../application/services/metrics.service';
import { ClosedChatFlow } from '../../domain/flows/closed-chat.flow';
import { ChatEnvironment } from '../../domain/enums/chat-environment.enum';

// DTOs
export class MockOpenChatRequestDto {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  environment: ChatEnvironment;
}

export class MockClosedChatRequestDto {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  environment: ChatEnvironment;
  currentState?: any;
}

@Controller('chat-mock')
export class MockOnlyChatController {
  private mockOpenChatUseCase: ProcessOpenChatMessageUseCase;
  private mockClosedChatUseCase: ProcessClosedChatMessageUseCase;

  constructor(
    private readonly cacheService: CacheService,
  ) {
    // Criar instâncias que SEMPRE usam mock
    const mockVirtualService = new MockVirtualAssistanceService();
    const mockUserRepo = new MockUserRepository();
    // Mock NotificationService, ResumoConversaService e GeminiAIService
    const mockNotificationService = {} as any;
    const mockResumoConversaService = {} as any;
    const mockGeminiAIService = {} as any;
    const mockClosedFlow = new ClosedChatFlow(
      mockUserRepo,
      mockNotificationService,
      mockResumoConversaService,
      mockGeminiAIService,
      mockVirtualService,
    );
    const mockPromptService = new PromptService();
    const mockMetricsService = new MetricsService(this.cacheService);
    const mockAIService = new GeminiAIService(
      { get: () => process.env.GOOGLE_GENERATIVE_AI_API_KEY } as any,
      mockVirtualService as any,
      this.cacheService,
      mockPromptService,
      mockMetricsService
    );

    const mockConfigService = {
      get: (key: string, defaultValue?: string) => {
        if (key === 'REPORTS_ENABLED') return 'false';
        return defaultValue || process.env[key];
      }
    } as ConfigService;

    this.mockOpenChatUseCase = new ProcessOpenChatMessageUseCase(
      mockUserRepo,
      mockAIService,
      mockConfigService
    );

    this.mockClosedChatUseCase = new ProcessClosedChatMessageUseCase(
      mockUserRepo,
      mockClosedFlow
    );
  }

  @Post('open')
  @HttpCode(HttpStatus.OK)
  async processOpenMessage(@Body() request: MockOpenChatRequestDto) {
    return this.mockOpenChatUseCase.execute(request);
  }

  @Post('closed') 
  @HttpCode(HttpStatus.OK)
  async processClosedMessage(@Body() request: MockClosedChatRequestDto) {
    return this.mockClosedChatUseCase.execute(request);
  }
}