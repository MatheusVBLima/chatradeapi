import { Controller, Get, Param, NotFoundException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ReportService } from '../../application/services/report.service';
import { CacheService } from '../../application/services/cache.service';
import { randomUUID } from 'crypto';

@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  @Get('from-cache/:cacheId/:format')
  async generateReportFromCache(
    @Param('cacheId') cacheId: string,
    @Param('format') format: 'txt' | 'csv' | 'pdf',
    @Res() res: Response,
  ) {
    const reportsEnabled = this.configService.get('REPORTS_ENABLED', 'true') === 'true';

    if (!reportsEnabled) {
      return res.status(503).json({
        message: 'O serviço de relatórios está temporariamente em manutenção. Tente novamente mais tarde.',
        status: 'maintenance'
      });
    }

    const cachedData = this.cacheService.get(cacheId);

    if (!cachedData) {
      throw new NotFoundException('Dados do relatório não encontrados ou expirados. Por favor, solicite o relatório novamente.');
    }

    // It's good practice to remove the data from cache once it's used
    this.cacheService.delete(cacheId);

    // Extrair dados e título
    const { data, title = 'Dados' } = cachedData;
    const reportData = data || cachedData; // Compatibilidade com cache antigo

    const fileName = `relatorio_${title.toLowerCase().replace(/\s+/g, '_')}.${format}`;

    try {
      if (format === 'pdf') {
        const pdfBuffer = await this.reportService.generatePdfReport(reportData, title);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(pdfBuffer);
      } else if (format === 'csv') {
        const csvContent = this.reportService.generateCsvReport(reportData, title);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(csvContent);
      } else {
        const txtContent = this.reportService.generateTxtReport(reportData, title);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(txtContent);
      }
    } catch (error) {
        console.error("Error generating report:", error);
        throw new Error('Falha ao gerar o relatório.');
    }
  }
} 