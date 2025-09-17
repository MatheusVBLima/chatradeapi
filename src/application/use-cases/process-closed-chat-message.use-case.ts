import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { ClosedChatFlow, ClosedChatState } from '../../domain/flows/closed-chat.flow';
import { User } from '../../domain/entities/user.entity';

export interface ProcessClosedChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
  state?: ClosedChatState; 
}

export interface ProcessClosedChatMessageResponse {
  response: string;
  success: boolean;
  nextState: ClosedChatState | null;
  error?: string;
}

@Injectable()
export class ProcessClosedChatMessageUseCase {
  constructor(
    @Inject('UserRepository') private readonly userRepository: UserRepository,
    private readonly closedChatFlow: ClosedChatFlow,
  ) {}

  async execute(request: ProcessClosedChatMessageRequest): Promise<ProcessClosedChatMessageResponse> {
    try {
      // Logic to find user is similar to open chat, we can extract it later
      let user: User | null = null;
      
      if (request.userId) {
        user = await this.userRepository.findById(request.userId);
      } else if (request.phone) {
        user = await this.userRepository.findByPhone(request.phone);
      } else if (request.email) {
        user = await this.userRepository.findByEmail(request.email);
      }

      const { response, nextState } = await this.closedChatFlow.handle(
        request.message, 
        request.state ?? null, 
        user ?? undefined
      );

      return {
        response,
        nextState,
        success: true,
      };

    } catch (error) {
      console.error('Error processing closed chat message:', error);
      return {
        response: 'Desculpe, ocorreu um erro interno no fluxo de chat. Tente novamente em alguns instantes.',
        success: false,
        nextState: request.state ?? null, // Return the same state on error
        error: error.message
      };
    }
  }
} 