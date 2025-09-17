import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { MetricsService, MetricsSummary } from '../../application/services/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  getSummary(): MetricsSummary {
    return this.metricsService.getSummary();
  }

  @Get('raw')
  getRawMetrics() {
    return {
      metrics: this.metricsService.getStoredMetrics(),
      count: this.metricsService.getStoredMetrics().length
    };
  }

  @Post('clear')
  @HttpCode(HttpStatus.OK)
  clearMetrics() {
    this.metricsService.clearMetrics();
    return { message: 'Metrics cleared successfully' };
  }
}