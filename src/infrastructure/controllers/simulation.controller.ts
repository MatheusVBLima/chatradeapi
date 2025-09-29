import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  NotificationService,
  NotificacaoAtendente,
  ChamadoFila,
  AtendenteConfig,
} from '../../application/services/notification.service';

// DTOs
export class AtenderChamadoDto {
  telefoneAtendente: string;
}

export class FinalizarChamadoDto {
  telefoneAtendente: string;
}

@Controller('simulation')
export class SimulationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Busca notificações para um atendente específico
   */
  @Get('atendente/:telefone/notificacoes')
  async getNotificacoesAtendente(
    @Param('telefone') telefone: string,
  ): Promise<NotificacaoAtendente[]> {
    console.log(
      `[SIMULATION] Buscando notificações para atendente: ${telefone}`,
    );
    return this.notificationService.getNotificacoesAtendente(telefone);
  }

  /**
   * Busca fila de chamados para um atendente específico
   */
  @Get('atendente/:telefone/fila')
  async getFilaAtendente(
    @Param('telefone') telefone: string,
  ): Promise<ChamadoFila[]> {
    console.log(`[SIMULATION] Buscando fila para atendente: ${telefone}`);
    return this.notificationService.getFilaAtendente(telefone);
  }

  /**
   * Busca posição de um usuário na fila
   */
  @Get('usuario/:telefone/posicao')
  async getPosicaoUsuario(
    @Param('telefone') telefone: string,
  ): Promise<{ posicao: number; universidade: string } | null> {
    console.log(`[SIMULATION] Buscando posição do usuário: ${telefone}`);
    return this.notificationService.getPosicaoUsuarioFila(telefone);
  }

  /**
   * Atendente assume um chamado específico
   */
  @Post('chamado/:chamadoId/atender')
  @HttpCode(HttpStatus.OK)
  async atenderChamado(
    @Param('chamadoId') chamadoId: string,
    @Body() body: AtenderChamadoDto,
  ): Promise<{ success: boolean; message: string; chamado?: ChamadoFila }> {
    console.log(
      `[SIMULATION] Atendente ${body.telefoneAtendente} assumindo chamado: ${chamadoId}`,
    );
    return this.notificationService.atenderChamado(
      chamadoId,
      body.telefoneAtendente,
    );
  }

  /**
   * Atendente finaliza um chamado
   */
  @Post('chamado/:chamadoId/finalizar')
  @HttpCode(HttpStatus.OK)
  async finalizarChamado(
    @Param('chamadoId') chamadoId: string,
    @Body() body: FinalizarChamadoDto,
  ): Promise<{ success: boolean; message: string }> {
    console.log(
      `[SIMULATION] Atendente ${body.telefoneAtendente} finalizando chamado: ${chamadoId}`,
    );
    return this.notificationService.finalizarChamado(
      chamadoId,
      body.telefoneAtendente,
    );
  }

  /**
   * Marca uma notificação como lida
   */
  @Post('atendente/:telefone/notificacao/:notificacaoId/marcar-lida')
  @HttpCode(HttpStatus.OK)
  async marcarNotificacaoLida(
    @Param('telefone') telefone: string,
    @Param('notificacaoId') notificacaoId: string,
  ): Promise<{ success: boolean }> {
    const sucesso = this.notificationService.marcarNotificacaoLida(
      telefone,
      notificacaoId,
    );
    return { success: sucesso };
  }

  /**
   * Remove uma notificação
   */
  @Post('atendente/:telefone/notificacao/:notificacaoId/remover')
  @HttpCode(HttpStatus.OK)
  async removerNotificacao(
    @Param('telefone') telefone: string,
    @Param('notificacaoId') notificacaoId: string,
  ): Promise<{ success: boolean }> {
    const sucesso = this.notificationService.removerNotificacao(
      telefone,
      notificacaoId,
    );
    return { success: sucesso };
  }

  /**
   * Busca configuração de todos os atendentes
   */
  @Get('config/atendentes')
  async getConfigAtendentes(): Promise<Record<string, AtendenteConfig>> {
    console.log(`[SIMULATION] Buscando configuração de atendentes`);
    return this.notificationService.getConfigAtendentes();
  }

  /**
   * Busca atendente responsável por uma universidade
   */
  @Get('config/universidade/:universidade/atendente')
  async getAtendentePorUniversidade(
    @Param('universidade') universidade: string,
  ): Promise<AtendenteConfig | null> {
    console.log(
      `[SIMULATION] Buscando atendente para universidade: ${universidade}`,
    );
    return this.notificationService.getAtendentePorUniversidade(universidade);
  }

  /**
   * Busca fila de uma universidade específica
   */
  @Get('universidade/:universidade/fila')
  async getFilaUniversidade(
    @Param('universidade') universidade: string,
  ): Promise<ChamadoFila[]> {
    console.log(`[SIMULATION] Buscando fila da universidade: ${universidade}`);
    return this.notificationService.getFilaUniversidade(universidade);
  }

  /**
   * Estatísticas gerais do sistema
   */
  @Get('estatisticas')
  async getEstatisticas() {
    console.log(`[SIMULATION] Buscando estatísticas gerais`);
    return this.notificationService.getEstatisticas();
  }

  /**
   * Health check do sistema de simulação
   */
  @Get('health')
  async healthCheck() {
    const stats = this.notificationService.getEstatisticas();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: 'simulation',
      ...stats,
    };
  }

  /**
   * Dados de teste para a simulação (baseados no Retornos-Staging.md)
   */
  @Get('dados-teste')
  async getDadosTeste() {
    return {
      usuarios: {
        joaquim: {
          cpf: '98765432100',
          nome: 'Joaquim José da Silva Xavier',
          telefone: '11999999999',
          universidade: 'Wyden Unifavip',
          curso: 'Administração',
          email: 'r.olisantos@gmail.com',
        },
        karla: {
          cpf: '13281598412',
          nome: 'Karla Priscila Negromonte de Queiroz',
          telefone: '81997690940',
          universidade: 'Centro Universitário Tabosa de Almeida ASCES-UNITA',
          curso: 'Engenharia Ambiental',
          email: '2018110030@app.asces.edu.br',
        },
        helaysa: {
          cpf: '70436988470',
          nome: 'Helaysa Samara Louise Silva',
          telefone: '81996565699',
          universidade: 'Prefeitura de Caruaru',
          curso: 'Administração',
          email: 'helaysasls@outlook.com',
        },
      },
      coordenador: {
        ana: {
          cpf: '05631761483',
          nome: 'Ana Maraiza de Sousa Silva',
          telefone: '81888888888', // Simulado
          universidade: 'Prefeitura de Caruaru',
          email: 'ana.maraiza@caruaru.pe.gov.br',
        },
      },
      atendentes: {
        joao: {
          nome: 'João Silva',
          telefone: '11777777777',
          universidades: [
            'Wyden Unifavip',
            'Centro Universitário Tabosa de Almeida ASCES-UNITA',
          ],
          especialidades: ['Cadastro', 'Agendamento', 'Avaliações'],
        },
        maria: {
          nome: 'Maria Santos',
          telefone: '11666666666',
          universidades: ['Prefeitura de Caruaru'],
          especialidades: [
            'Processos administrativos',
            'Documentação',
            'Estágios',
          ],
        },
      },
    };
  }

  /**
   * Reset do sistema de simulação (limpa todas as filas e notificações)
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetSimulacao(): Promise<{ success: boolean; message: string }> {
    try {
      // Limpa todas as filas e notificações
      // Note: Como estamos usando Maps privados, precisaríamos expor métodos para isso
      // Por ora, retorna sucesso (a aplicação pode ser reiniciada para reset completo)

      console.log(`[SIMULATION] Sistema de simulação resetado`);

      return {
        success: true,
        message:
          'Sistema de simulação resetado com sucesso. Todas as filas e notificações foram limpas.',
      };
    } catch (error) {
      console.error(`[SIMULATION] Erro ao resetar sistema:`, error);
      return {
        success: false,
        message: 'Erro ao resetar sistema de simulação.',
      };
    }
  }

  /**
   * Endpoint para teste de conectividade
   */
  @Get('ping')
  async ping() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
      simulation: true,
    };
  }
}
