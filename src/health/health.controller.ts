import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
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