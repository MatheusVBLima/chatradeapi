import { User } from '../entities/user.entity';
// CoreTool removed in AI SDK v5 - using Record<string, any> for tools

export interface AIToolCallResult {
  text: string;
  messages: Array<{ role: string; content: any }>;
}

export interface AIService {
  // This method is deprecated and should be removed after the transition to tool calling is complete.
  generateResponse(
    userMessage: string,
    userData: User | User[],
  ): Promise<string>;

  processToolCall(
    actor: User,
    userMessage: string,
    availableTools: Record<string, any>,
    maxToolDepth?: number,
    conversationHistory?: Array<{ role: string; content: any }>,
  ): Promise<AIToolCallResult>;
}
