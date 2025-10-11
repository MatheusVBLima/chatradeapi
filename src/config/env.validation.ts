import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumberString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

enum ChatMode {
  Open = 'open',
  Closed = 'closed',
  Hybrid = 'hybrid',
}

export class EnvironmentVariables {
  // Environment Configuration
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumberString()
  @IsNotEmpty()
  PORT: string;

  // Application Configuration
  @IsString()
  @IsNotEmpty()
  USE_API_DATA: string;

  @IsString()
  @IsOptional()
  REPORTS_ENABLED?: string;

  // RADE API Configuration
  @IsString()
  @IsNotEmpty()
  RADE_API_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  RADE_API_TOKEN: string;

  // Gemini AI Configuration
  @IsString()
  @IsNotEmpty()
  GOOGLE_GENERATIVE_AI_API_KEY: string;

  // Chat Configuration
  @IsEnum(ChatMode)
  @IsOptional()
  DEFAULT_CHAT_MODE?: ChatMode;

  // Z-API WhatsApp Configuration
  @IsString()
  @IsNotEmpty()
  ZAPI_INSTANCE_ID: string;

  @IsString()
  @IsNotEmpty()
  ZAPI_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  ZAPI_CLIENT_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  ZAPI_BASE_URL: string;

  // Optional Configuration
  @IsString()
  @IsOptional()
  RENDER_EXTERNAL_URL?: string;

  @IsString()
  @IsOptional()
  AI_CHAT_URL?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  // Atendentes Configuration (optional)
  @IsString()
  @IsOptional()
  ATENDENTE_ISABEL_NOME?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_ISABEL_TELEFONE?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_ISABEL_UNIVERSIDADES?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_KALINA_NOME?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_KALINA_TELEFONE?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_KALINA_UNIVERSIDADES?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_PAMELA_NOME?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_PAMELA_TELEFONE?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_PAMELA_UNIVERSIDADES?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_VITORIA_NOME?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_VITORIA_TELEFONE?: string;

  @IsString()
  @IsOptional()
  ATENDENTE_VITORIA_UNIVERSIDADES?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const missingVars = errors.map((error) => {
      const constraints = Object.values(error.constraints || {});
      return `  - ${error.property}: ${constraints.join(', ')}`;
    });

    throw new Error(
      `❌ Environment validation failed:\n\n${missingVars.join('\n')}\n\n` +
        'Please check your .env file and ensure all required variables are set.\n' +
        'Refer to .env.example for the complete list of required variables.',
    );
  }

  return validatedConfig;
}
