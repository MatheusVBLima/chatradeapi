import { Controller, Get, Param, NotFoundException, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ReportService } from '../../application/services/report.service';
import { CacheService } from '../../application/services/cache.service';
import { randomUUID } from 'crypto';

@ApiTags('reports')
@Controller('reports')
export class ReportController {
  private readonly logger = new Logger(ReportController.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  @Get('from-cache/:cacheId/:format')
  @ApiOperation({
    summary: 'Gerar relatório a partir do cache',
    description: `Gera um relatório nos formatos TXT, CSV ou PDF a partir de dados armazenados em cache.

O fluxo típico é:
1. Dados são armazenados em cache com um ID único
2. Este endpoint é chamado com o cacheId e formato desejado
3. O relatório é gerado e retornado como download
4. Os dados são removidos do cache após o uso

Útil para evitar processamento pesado em tempo real e permitir geração assíncrona de relatórios.`,
  })
  @ApiParam({
    name: 'cacheId',
    description: 'ID único dos dados armazenados em cache',
    example: 'abc123-def456-ghi789',
  })
  @ApiParam({
    name: 'format',
    description: 'Formato do relatório desejado',
    enum: ['txt', 'csv', 'pdf'],
    example: 'pdf',
  })
  @ApiResponse({
    status: 200,
    description: 'Relatório gerado com sucesso (retorna arquivo para download)',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
      'text/csv': { schema: { type: 'string' } },
      'text/plain': { schema: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Dados não encontrados ou expirados no cache',
  })
  @ApiResponse({
    status: 503,
    description: 'Serviço de relatórios em manutenção',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'O serviço de relatórios está temporariamente em manutenção.' },
        status: { type: 'string', example: 'maintenance' },
      },
    },
  })
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

    // Extrair dados, título e labels de seção
    const { data, title = 'Dados', sectionLabels = null } = cachedData;
    const reportData = data || cachedData; // Compatibilidade com cache antigo

    const fileName = `relatorio_${title.toLowerCase().replace(/\s+/g, '_')}.${format}`;

    try {
      if (format === 'pdf') {
        const pdfBuffer = await this.reportService.generatePdfReport(reportData, title, sectionLabels);
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
        this.logger.error('Error generating report:', error);
        throw new Error('Falha ao gerar o relatório.');
    }
  }
} 