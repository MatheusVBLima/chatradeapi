import { User } from '../entities/user.entity';
import { CoreTool } from 'ai';

export interface AIService {
  // This method is deprecated and should be removed after the transition to tool calling is complete.
  generateResponse(userMessage: string, userData: User | User[]): Promise<string>;

  processToolCall(actor: User, userMessage: string, availableTools: Record<string, CoreTool>): Promise<string>;
} 