import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health checks should never be rate limited
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Health check principal',
    description: 'Verifica o status da API. Retorna informações básicas sobre saúde, memória e configuração. Sem rate limit.',
  })
  @ApiResponse({
    status: 200,
    description: 'API funcionando normalmente',
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chatbot-api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      },
      api: {
        useApiData: process.env.USE_API_DATA === 'true',
        radeApiUrl: process.env.RADE_API_BASE_URL || 'not configured'
      }
    };
  }

  @Get('detailed')
  @ApiOperation({
    summary: 'Health check detalhado',
    description: 'Retorna informações completas sobre o sistema incluindo CPU, memória detalhada, plataforma e versão do Node.js. Sem rate limit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Informações detalhadas do sistema',
  })
  detailedCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chatbot-api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      api: {
        useApiData: process.env.USE_API_DATA === 'true',
        radeApiUrl: process.env.RADE_API_BASE_URL || 'not configured',
        hasZapiConfig: !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN)
      }
    };
  }
}