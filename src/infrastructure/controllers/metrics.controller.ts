import { Controller, Get, Post, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService, MetricsSummary } from '../../application/services/metrics.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Obter resumo de métricas',
    description: 'Retorna um resumo consolidado das métricas de uso do chatbot, incluindo total de conversas, duração média, sucessos/falhas, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumo das métricas',
    schema: {
      type: 'object',
      properties: {
        totalConversations: { type: 'number', example: 150 },
        successfulConversations: { type: 'number', example: 140 },
        failedConversations: { type: 'number', example: 10 },
        averageDuration: { type: 'number', example: 45.5 },
        totalMessages: { type: 'number', example: 450 },
      },
    },
  })
  getSummary(): MetricsSummary {
    this.logger.log('Getting metrics summary');
    return this.metricsService.getSummary();
  }

  @Get('raw')
  @ApiOperation({
    summary: 'Obter métricas brutas',
    description: 'Retorna todas as métricas armazenadas sem agregação. Útil para análise detalhada e exportação de dados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados brutos de métricas',
    schema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'array',
          items: { type: 'object' },
        },
        count: { type: 'number', example: 150 },
      },
    },
  })
  getRawMetrics() {
    this.logger.log('Getting raw metrics');
    return {
      metrics: this.metricsService.getStoredMetrics(),
      count: this.metricsService.getStoredMetrics().length
    };
  }

  @Post('clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Limpar métricas armazenadas',
    description: 'Remove todas as métricas armazenadas em memória. Use com cuidado em produção.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas limpas com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Metrics cleared successfully' },
      },
    },
  })
  clearMetrics() {
    this.logger.log('Clearing all metrics');
    this.metricsService.clearMetrics();
    return { message: 'Metrics cleared successfully' };
  }
}