import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../domain/repositories/user.repository';
import { AIService } from '../../domain/services/ai.service';
import { User } from '../../domain/entities/user.entity';
import { getVirtualAssistanceTools } from './ai-tools';
import { CoreTool } from 'ai';

export interface ProcessOpenChatMessageRequest {
  message: string;
  userId?: string;
  phone?: string;
  email?: string;
  channel: string;
}

export interface ProcessOpenChatMessageResponse {
  response: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class ProcessOpenChatMessageUseCase {

  constructor(
    @Inject('UserRepository') private readonly userRepository: UserRepository,
    @Inject('AIService') private readonly aiService: AIService,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: ProcessOpenChatMessageRequest): Promise<ProcessOpenChatMessageResponse> {
    try {
      let actor: User | null = null;
      if (request.userId) {
        // First, try to find the user by ID. If not found, try finding by CPF.
        // This makes the endpoint flexible for testing and future auth methods.
        actor = await this.userRepository.findById(request.userId);
        if (!actor) {
          actor = await this.userRepository.findByCpf(request.userId);
        }
      } else if (request.phone) {
        actor = await this.userRepository.findByPhone(request.phone);
      } else if (request.email) {
        actor = await this.userRepository.findByEmail(request.email);
      }

      if (!actor) {
        return {
          response: 'Desculpe, não consegui te identificar. Verifique se suas informações de acesso estão corretas.',
          success: false,
          error: 'Actor not found'
        };
      }
      
      // 2. Select tools based on the actor's role
      const availableTools = this.getToolsForRole(actor.role);
      
      // 3. Let the AI service handle the tool-calling logic  
      console.log('[USE-CASE] About to call processToolCall with tools:', Object.keys(availableTools));
      const aiResponse = await this.aiService.processToolCall(actor, request.message, availableTools);

      return {
        response: aiResponse,
        success: true
      };

    } catch (error) {
      console.error('Error processing chat message:', error);
      return {
        response: 'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.',
        success: false,
        error: error.message
      };
    }
  }

  private getToolsForRole(role: 'student' | 'coordinator'): Record<string, CoreTool> {
    const tools = getVirtualAssistanceTools(this.configService);
    
    const studentTools = {
      getStudentsScheduledActivities: tools.getStudentsScheduledActivities,
      getStudentsProfessionals: tools.getStudentsProfessionals,
      getStudentInfo: tools.getStudentInfo,
    };

    const coordinatorTools = {
      getCoordinatorsOngoingActivities: tools.getCoordinatorsOngoingActivities,
      getCoordinatorsProfessionals: tools.getCoordinatorsProfessionals,
      getCoordinatorsStudents: tools.getCoordinatorsStudents,
      getCoordinatorInfo: tools.getCoordinatorInfo,
    };

    // Common tools available for everyone
    const commonTools = {
      findPersonByName: tools.findPersonByName,
    };

    // Add generateReport only if enabled
    if ((tools as any).generateReport) {
      (commonTools as any).generateReport = (tools as any).generateReport;
    }

    if (role === 'coordinator') {
      // Coordinators can also use student tools to look up specific students
      return { ...commonTools, ...studentTools, ...coordinatorTools };
    }
    
    return { ...commonTools, ...studentTools };
  }
} 