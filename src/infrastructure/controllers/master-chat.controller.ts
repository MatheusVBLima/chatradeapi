import { Controller, Post, Body, HttpCode, HttpStatus, Get, Query } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { HybridChatController } from './hybrid-chat.controller';
import { 
  OpenChatRequestDto, 
  ClosedChatRequestDto, 
  ChatResponseDto 
} from './chat.controller';
import { HybridChatRequestDto, HybridChatResponseDto } from './hybrid-chat.controller';

type ChatMode = 'open' | 'closed' | 'hybrid';

// Master DTO that can handle all chat types
export class MasterChatRequestDto {
  message: string;
  mode?: ChatMode; // If not provided, uses DEFAULT_CHAT_MODE from env
  state?: any; // For closed/hybrid chat state management
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
}

export class ChatModeResponseDto {
  availableModes: ChatMode[];
  defaultMode: ChatMode;
  currentMode: ChatMode;
}

// Unified response type that can handle all chat types
export class MasterChatResponseDto {
  response: string;
  success: boolean;
  error?: string;
  nextState?: any; // Can be ClosedChatState or HybridChatState
}

@Controller('chat-master')
export class MasterChatController {
  private readonly defaultMode: ChatMode;

  constructor(
    private readonly chatController: ChatController,
    private readonly hybridChatController: HybridChatController,
  ) {
    this.defaultMode = (process.env.DEFAULT_CHAT_MODE as ChatMode) || 'hybrid';
  }

  @Get('modes')
  @HttpCode(HttpStatus.OK)
  async getAvailableModes(): Promise<ChatModeResponseDto> {
    return {
      availableModes: ['open', 'closed', 'hybrid'],
      defaultMode: this.defaultMode,
      currentMode: this.defaultMode,
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async processMessage(@Body() request: MasterChatRequestDto): Promise<MasterChatResponseDto> {
    const mode = request.mode || this.defaultMode;

    console.log(`[MASTER-CHAT] Processing message in ${mode} mode`);

    try {
      switch (mode) {
        case 'open':
          const openRequest: OpenChatRequestDto = {
            message: request.message,
            userId: request.userId,
            phone: request.phone,
            email: request.email,
            channel: request.channel,
          };
          const openResult = await this.chatController.processOpenMessage(openRequest);
          return {
            response: openResult.response,
            success: openResult.success,
            error: openResult.error,
            nextState: openResult.nextState,
          };

        case 'closed':
          const closedRequest: ClosedChatRequestDto = {
            message: request.message,
            userId: request.userId,
            phone: request.phone,
            email: request.email,
            channel: request.channel,
            state: request.state,
          };
          const closedResult = await this.chatController.processClosedMessage(closedRequest);
          return {
            response: closedResult.response,
            success: closedResult.success,
            error: closedResult.error,
            nextState: closedResult.nextState,
          };

        case 'hybrid':
          const hybridRequest: HybridChatRequestDto = {
            message: request.message,
            state: request.state,
            channel: request.channel,
          };
          const hybridResult = await this.hybridChatController.processHybridMessage(hybridRequest);
          return {
            response: hybridResult.response,
            success: hybridResult.success,
            error: hybridResult.error,
            nextState: hybridResult.nextState,
          };

        default:
          return {
            response: `Modo de chat '${mode}' não é válido. Modos disponíveis: open, closed, hybrid`,
            success: false,
            error: 'Invalid chat mode',
          };
      }
    } catch (error) {
      console.error(`[MASTER-CHAT] Error in ${mode} mode:`, error);
      return {
        response: 'Erro interno no processamento do chat. Tente novamente.',
        success: false,
        error: error.message,
      };
    }
  }

  @Post('open')
  @HttpCode(HttpStatus.OK)
  async processOpenMessage(@Body() request: OpenChatRequestDto): Promise<ChatResponseDto> {
    console.log('[MASTER-CHAT] Redirecting to open chat');
    return await this.chatController.processOpenMessage(request);
  }

  @Post('closed')
  @HttpCode(HttpStatus.OK)
  async processClosedMessage(@Body() request: ClosedChatRequestDto): Promise<ChatResponseDto> {
    console.log('[MASTER-CHAT] Redirecting to closed chat');
    return await this.chatController.processClosedMessage(request);
  }

  @Post('hybrid')
  @HttpCode(HttpStatus.OK)
  async processHybridMessage(@Body() request: HybridChatRequestDto): Promise<MasterChatResponseDto> {
    console.log('[MASTER-CHAT] Redirecting to hybrid chat');
    const result = await this.hybridChatController.processHybridMessage(request);
    return {
      response: result.response,
      success: result.success,
      error: result.error,
      nextState: result.nextState,
    };
  }
}