import { IsString, IsOptional, IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ChatEnvironment } from '../../domain/enums/chat-environment.enum';
import { ClosedChatState } from '../../domain/flows/closed-chat.flow';
import { OpenChatState } from '../../domain/flows/open-chat.flow';

/**
 * Base DTO for all chat requests
 */
export class BaseChatRequestDto {
  @ApiProperty({
    description: 'Mensagem do usuário',
    example: 'Olá! Quais são minhas atividades?',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  message: string;

  @ApiProperty({
    description: 'Ambiente de onde vem a requisição',
    enum: ChatEnvironment,
    example: ChatEnvironment.WEB,
  })
  @IsEnum(ChatEnvironment, { message: 'Environment must be either "web" or "mobile"' })
  environment: ChatEnvironment;

  @ApiPropertyOptional({
    description: 'Identificador do usuário (CPF, email, ou UUID)',
    example: '12345678901',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Telefone do usuário',
    example: '5511999999999',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email do usuário',
    example: 'usuario@exemplo.com',
  })
  @IsString()
  @IsOptional()
  email?: string;
}

/**
 * DTO for open chat requests
 */
export class OpenChatRequestDto extends BaseChatRequestDto {
  // No additional fields needed for open chat
}

/**
 * DTO for closed chat requests
 */
export class ClosedChatRequestDto extends BaseChatRequestDto {
  @ApiPropertyOptional({
    description: 'Estado atual da conversa (para continuar conversa existente)',
  })
  @IsOptional()
  state?: ClosedChatState;
}

/**
 * DTO for hybrid chat requests
 */
export class HybridChatRequestDto extends BaseChatRequestDto {
  @ApiPropertyOptional({
    description: 'Estado atual da conversa híbrida',
  })
  @IsOptional()
  state?: any; // Hybrid chat state
}

/**
 * DTO for test open chat requests
 */
export class TestOpenChatRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  message: string;

  @IsEnum(ChatEnvironment, { message: 'Environment must be either "web" or "mobile"' })
  environment: ChatEnvironment;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsOptional()
  state?: OpenChatState;
}

/**
 * DTO for test closed chat requests
 */
export class TestClosedChatRequestDto extends BaseChatRequestDto {
  @IsOptional()
  state?: ClosedChatState;
}

/**
 * DTO for test hybrid chat requests
 */
export class TestHybridChatRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  message: string;

  @IsEnum(ChatEnvironment, { message: 'Environment must be either "web" or "mobile"' })
  environment: ChatEnvironment;

  @IsOptional()
  state?: any;
}

/**
 * DTO for master chat requests
 */
export class MasterChatRequestDto extends BaseChatRequestDto {
  @IsString()
  @IsOptional()
  @IsEnum(['open', 'closed', 'hybrid'], { message: 'Mode must be "open", "closed", or "hybrid"' })
  mode?: 'open' | 'closed' | 'hybrid';

  @IsOptional()
  state?: any;
}

/**
 * Base response DTO for all chat responses
 */
export class ChatResponseDto {
  @ApiProperty({
    description: 'Resposta do chatbot',
    example: 'Olá! Encontrei 3 atividades agendadas para você.',
  })
  @IsString()
  response: string;

  @ApiProperty({
    description: 'Indica se a requisição foi bem-sucedida',
    example: true,
  })
  @IsNotEmpty()
  success: boolean;

  @ApiPropertyOptional({
    description: 'Mensagem de erro (se houver)',
    example: 'Erro ao processar mensagem',
  })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiPropertyOptional({
    description: 'Próximo estado da conversa (para chat com estado)',
  })
  @IsOptional()
  nextState?: any; // Can be ClosedChatState, OpenChatState, or HybridChatState
}

/**
 * DTO for hybrid chat responses
 */
export class HybridChatResponseDto extends ChatResponseDto {
  // Hybrid chat specific response fields if needed
}

/**
 * DTO for master chat responses
 */
export class MasterChatResponseDto extends ChatResponseDto {
  // Master chat specific response fields if needed
}

/**
 * DTO for test chat responses
 */
export class TestChatResponseDto extends ChatResponseDto {
  // Test chat specific response fields if needed
}
