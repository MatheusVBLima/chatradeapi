import { Injectable } from '@nestjs/common';

export interface NotificacaoAtendente {
  id: string;
  tipo: 'novo_chamado' | 'chamado_finalizado';
  usuario: string;
  telefone: string;
  universidade: string;
  resumoConversa?: string;
  timestamp: Date;
  lida: boolean;
}

export interface ChamadoFila {
  id: string;
  telefoneUsuario: string;
  nomeUsuario: string;
  universidade: string;
  cpfUsuario: string;
  resumoConversa: string;
  posicaoAtual: number;
  criadoEm: Date;
  status: 'aguardando' | 'em_atendimento' | 'finalizado';
  atendenteResponsavel?: string;
}

export interface AtendenteConfig {
  nome: string;
  telefone: string;
  universidades: string[];
  maxChamados: number;
  chamadosAtivos: number;
}

@Injectable()
export class SimulationService {
  // Cache em memória para notificações por telefone do atendente
  private readonly notificacoes = new Map<string, NotificacaoAtendente[]>();

  // Cache em memória para filas por universidade
  private readonly filas = new Map<string, ChamadoFila[]>();

  // Configuração dos atendentes (pode vir de env later)
  private readonly atendentes: Record<string, AtendenteConfig> = {
    'Wyden Unifavip': {
      nome: 'João Silva',
      telefone: '11777777777',
      universidades: ['Wyden Unifavip', 'Centro Universitário Tabosa de Almeida ASCES-UNITA'],
      maxChamados: 5,
      chamadosAtivos: 0
    },
    'Centro Universitário Tabosa de Almeida ASCES-UNITA': {
      nome: 'João Silva',
      telefone: '11777777777',
      universidades: ['Wyden Unifavip', 'Centro Universitário Tabosa de Almeida ASCES-UNITA'],
      maxChamados: 5,
      chamadosAtivos: 0
    },
    'Prefeitura de Caruaru': {
      nome: 'Maria Santos',
      telefone: '11666666666',
      universidades: ['Prefeitura de Caruaru'],
      maxChamados: 10,
      chamadosAtivos: 0
    }
  };

  /**
   * Adiciona um chamado à fila de uma universidade
   */
  async adicionarChamadoFila(dadosChamado: {
    telefoneUsuario: string;
    nomeUsuario: string;
    universidade: string;
    cpfUsuario: string;
    resumoConversa: string;
  }): Promise<ChamadoFila> {
    const chamadoId = `chamado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Busca fila da universidade ou cria nova
    const filaUniversidade = this.filas.get(dadosChamado.universidade) || [];

    const novoChamado: ChamadoFila = {
      id: chamadoId,
      telefoneUsuario: dadosChamado.telefoneUsuario,
      nomeUsuario: dadosChamado.nomeUsuario,
      universidade: dadosChamado.universidade,
      cpfUsuario: dadosChamado.cpfUsuario,
      resumoConversa: dadosChamado.resumoConversa,
      posicaoAtual: 0, // Será calculado após adicionar à fila
      criadoEm: new Date(),
      status: 'aguardando'
    };

    // Adiciona à fila
    filaUniversidade.push(novoChamado);
    this.filas.set(dadosChamado.universidade, filaUniversidade);

    // Recalcula todas as posições da fila para garantir consistência
    this.recalcularPosicoesFila(dadosChamado.universidade);

    // Envia notificação para atendente
    await this.enviarNotificacaoAtendente(dadosChamado.universidade, novoChamado);

    console.log(`[SIMULATION] Chamado adicionado à fila: ${chamadoId} - ${dadosChamado.universidade} - Posição: ${novoChamado.posicaoAtual}`);

    return novoChamado;
  }

  /**
   * Envia notificação para o atendente responsável pela universidade
   */
  private async enviarNotificacaoAtendente(universidade: string, chamado: ChamadoFila): Promise<void> {
    const atendente = this.atendentes[universidade];

    if (!atendente) {
      console.warn(`[SIMULATION] Atendente não encontrado para universidade: ${universidade}`);
      return;
    }

    const notificacao: NotificacaoAtendente = {
      id: `notif_${chamado.id}`,
      tipo: 'novo_chamado',
      usuario: chamado.nomeUsuario,
      telefone: chamado.telefoneUsuario,
      universidade: universidade,
      resumoConversa: chamado.resumoConversa,
      timestamp: new Date(),
      lida: false
    };

    // Adiciona notificação à lista do atendente
    const notificacoesAtendente = this.notificacoes.get(atendente.telefone) || [];
    notificacoesAtendente.push(notificacao);
    this.notificacoes.set(atendente.telefone, notificacoesAtendente);

    console.log(`[SIMULATION] Notificação enviada para ${atendente.nome} (${atendente.telefone}): ${chamado.nomeUsuario}`);
  }

  /**
   * Busca notificações para um atendente
   */
  getNotificacoesAtendente(telefoneAtendente: string): NotificacaoAtendente[] {
    return this.notificacoes.get(telefoneAtendente) || [];
  }

  /**
   * Marca notificação como lida
   */
  marcarNotificacaoLida(telefoneAtendente: string, notificacaoId: string): boolean {
    const notificacoes = this.notificacoes.get(telefoneAtendente) || [];
    const notificacao = notificacoes.find(n => n.id === notificacaoId);

    if (notificacao) {
      notificacao.lida = true;
      return true;
    }

    return false;
  }

  /**
   * Remove notificação
   */
  removerNotificacao(telefoneAtendente: string, notificacaoId: string): boolean {
    const notificacoes = this.notificacoes.get(telefoneAtendente) || [];
    const index = notificacoes.findIndex(n => n.id === notificacaoId);

    if (index >= 0) {
      notificacoes.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Busca fila de uma universidade
   */
  getFilaUniversidade(universidade: string): ChamadoFila[] {
    return this.filas.get(universidade) || [];
  }

  /**
   * Busca fila para um atendente (todas suas universidades)
   */
  getFilaAtendente(telefoneAtendente: string): ChamadoFila[] {
    // Encontra atendente
    const atendenteData = Object.values(this.atendentes).find(a => a.telefone === telefoneAtendente);

    if (!atendenteData) {
      return [];
    }

    // Busca chamados de todas as universidades do atendente
    const todosChamados: ChamadoFila[] = [];

    for (const universidade of atendenteData.universidades) {
      const filaUniversidade = this.filas.get(universidade) || [];
      todosChamados.push(...filaUniversidade);
    }

    // Ordena por data de criação (mais antigos primeiro)
    const chamadosOrdenados = todosChamados.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

    // Recalcula posições considerando todas as universidades do atendente como uma fila única
    const chamadosAguardando = chamadosOrdenados.filter(c => c.status === 'aguardando');
    chamadosAguardando.forEach((chamado, index) => {
      chamado.posicaoAtual = index + 1;
    });

    return chamadosOrdenados;
  }

  /**
   * Atende um chamado específico
   */
  async atenderChamado(chamadoId: string, telefoneAtendente: string): Promise<{ success: boolean; message: string; chamado?: ChamadoFila }> {
    // Encontra o chamado em qualquer fila
    let chamadoEncontrado: ChamadoFila | null = null;
    let universidadeChamado: string | null = null;

    for (const [universidade, fila] of this.filas.entries()) {
      const chamado = fila.find(c => c.id === chamadoId);
      if (chamado) {
        chamadoEncontrado = chamado;
        universidadeChamado = universidade;
        break;
      }
    }

    if (!chamadoEncontrado) {
      return { success: false, message: 'Chamado não encontrado' };
    }

    if (chamadoEncontrado.status !== 'aguardando') {
      return { success: false, message: 'Chamado já está sendo atendido ou foi finalizado' };
    }

    // Atualiza status do chamado
    chamadoEncontrado.status = 'em_atendimento';
    chamadoEncontrado.atendenteResponsavel = telefoneAtendente;

    // Remove notificação correspondente
    this.removerNotificacao(telefoneAtendente, `notif_${chamadoId}`);

    // Recalcula posições da fila
    this.recalcularPosicoesFila(universidadeChamado!);

    console.log(`[SIMULATION] Chamado ${chamadoId} foi assumido por atendente ${telefoneAtendente}`);

    return { success: true, message: 'Chamado assumido com sucesso', chamado: chamadoEncontrado };
  }

  /**
   * Finaliza um chamado
   */
  async finalizarChamado(chamadoId: string, telefoneAtendente: string): Promise<{ success: boolean; message: string }> {
    // Encontra o chamado
    let chamadoEncontrado: ChamadoFila | null = null;
    let universidadeChamado: string | null = null;

    for (const [universidade, fila] of this.filas.entries()) {
      const index = fila.findIndex(c => c.id === chamadoId);
      if (index >= 0) {
        chamadoEncontrado = fila[index];
        universidadeChamado = universidade;

        // Remove da fila
        fila.splice(index, 1);
        break;
      }
    }

    if (!chamadoEncontrado) {
      return { success: false, message: 'Chamado não encontrado' };
    }

    if (chamadoEncontrado.atendenteResponsavel !== telefoneAtendente) {
      return { success: false, message: 'Você não é responsável por este chamado' };
    }

    // Recalcula posições da fila
    this.recalcularPosicoesFila(universidadeChamado!);

    console.log(`[SIMULATION] Chamado ${chamadoId} foi finalizado por atendente ${telefoneAtendente}`);

    return { success: true, message: 'Chamado finalizado com sucesso' };
  }

  /**
   * Recalcula posições na fila após mudanças
   */
  private recalcularPosicoesFila(universidade: string): void {
    // Encontra o atendente responsável por esta universidade
    const atendente = this.atendentes[universidade];

    if (!atendente) {
      return;
    }

    // Busca todos os chamados aguardando de todas as universidades do atendente
    const todosChamadosAguardando: ChamadoFila[] = [];

    for (const univAtendente of atendente.universidades) {
      const fila = this.filas.get(univAtendente) || [];
      const chamadosAguardando = fila.filter(c => c.status === 'aguardando');
      todosChamadosAguardando.push(...chamadosAguardando);
    }

    // Reordena por data de criação e atualiza posições considerando todas as universidades
    todosChamadosAguardando
      .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
      .forEach((chamado, index) => {
        chamado.posicaoAtual = index + 1;
      });
  }

  /**
   * Busca posição atual de um usuário na fila
   */
  getPosicaoUsuarioFila(telefoneUsuario: string): { posicao: number; universidade: string } | null {
    for (const [universidade, fila] of this.filas.entries()) {
      const chamado = fila.find(c => c.telefoneUsuario === telefoneUsuario && c.status === 'aguardando');
      if (chamado) {
        // Força recálculo das posições para garantir consistência
        this.recalcularPosicoesFila(universidade);
        return { posicao: chamado.posicaoAtual, universidade };
      }
    }
    return null;
  }

  /**
   * Busca configuração dos atendentes
   */
  getConfigAtendentes(): Record<string, AtendenteConfig> {
    return this.atendentes;
  }

  /**
   * Busca atendente por universidade
   */
  getAtendentePorUniversidade(universidade: string): AtendenteConfig | null {
    return this.atendentes[universidade] || null;
  }

  /**
   * Estatísticas gerais
   */
  getEstatisticas() {
    const totalChamados = Array.from(this.filas.values()).reduce((total, fila) => total + fila.length, 0);
    const chamadosAguardando = Array.from(this.filas.values()).reduce((total, fila) => {
      return total + fila.filter(c => c.status === 'aguardando').length;
    }, 0);
    const chamadosEmAtendimento = Array.from(this.filas.values()).reduce((total, fila) => {
      return total + fila.filter(c => c.status === 'em_atendimento').length;
    }, 0);

    return {
      totalChamados,
      chamadosAguardando,
      chamadosEmAtendimento,
      filasPorUniversidade: Object.fromEntries(
        Array.from(this.filas.entries()).map(([univ, fila]) => [
          univ,
          {
            total: fila.length,
            aguardando: fila.filter(c => c.status === 'aguardando').length,
            emAtendimento: fila.filter(c => c.status === 'em_atendimento').length
          }
        ])
      )
    };
  }
}