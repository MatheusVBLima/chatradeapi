import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

export interface ChatMetric {
  timestamp: number;
  userId: string;
  userType: 'student' | 'coordinator';
  message: string;
  responseTime: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  toolsUsed: string[];
  cacheHits: number;
  fallbackUsed: boolean;
}

export interface MetricsSummary {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgResponseTime: number;
  topUsers: Array<{ userId: string; count: number; cost: number }>;
  toolUsage: Record<string, number>;
  cacheHitRate: number;
  recentActivity: ChatMetric[];
}

@Injectable()
export class MetricsService {
  private readonly METRICS_KEY = 'chat_metrics';
  private readonly MAX_STORED_METRICS = 1000; // Manter últimas 1000 interações

  constructor(private readonly cacheService: CacheService) {}

  recordChatMetric(metric: ChatMetric): void {
    const metrics = this.getStoredMetrics();
    metrics.push(metric);
    
    // Manter apenas os últimos N registros
    if (metrics.length > this.MAX_STORED_METRICS) {
      metrics.splice(0, metrics.length - this.MAX_STORED_METRICS);
    }
    
    this.cacheService.set(this.METRICS_KEY, metrics, 24 * 60 * 60 * 1000); // 24 horas
    console.log(`[METRICS] Recorded metric: ${metric.totalTokens} tokens, $${metric.estimatedCost.toFixed(6)}`);
  }

  getStoredMetrics(): ChatMetric[] {
    return this.cacheService.get(this.METRICS_KEY) || [];
  }

  getSummary(): MetricsSummary {
    const metrics = this.getStoredMetrics();
    
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        avgResponseTime: 0,
        topUsers: [],
        toolUsage: {},
        cacheHitRate: 0,
        recentActivity: []
      };
    }

    // Calcular totais
    const totalRequests = metrics.length;
    const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.estimatedCost, 0);
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;

    // Top usuários
    const userStats: Record<string, { count: number; cost: number }> = {};
    metrics.forEach(m => {
      if (!userStats[m.userId]) {
        userStats[m.userId] = { count: 0, cost: 0 };
      }
      userStats[m.userId].count++;
      userStats[m.userId].cost += m.estimatedCost;
    });
    
    const topUsers = Object.entries(userStats)
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Uso de ferramentas
    const toolUsage: Record<string, number> = {};
    metrics.forEach(m => {
      m.toolsUsed.forEach(tool => {
        toolUsage[tool] = (toolUsage[tool] || 0) + 1;
      });
    });

    // Cache hit rate
    const totalCacheHits = metrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalToolCalls = metrics.reduce((sum, m) => sum + m.toolsUsed.length, 0);
    const cacheHitRate = totalToolCalls > 0 ? (totalCacheHits / totalToolCalls) * 100 : 0;

    // Atividade recente (últimas 10)
    const recentActivity = metrics.slice(-10).reverse();

    return {
      totalRequests,
      totalTokens,
      totalCost,
      avgResponseTime,
      topUsers,
      toolUsage,
      cacheHitRate,
      recentActivity
    };
  }

  clearMetrics(): void {
    this.cacheService.delete(this.METRICS_KEY);
    console.log('[METRICS] All metrics cleared');
  }
}