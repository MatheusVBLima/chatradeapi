import { ChatEnvironment } from '../enums/chat-environment.enum';

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  timestamp: Date;
  environment: ChatEnvironment;
} 