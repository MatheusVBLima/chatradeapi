import { Injectable, Optional } from '@nestjs/common';
import { ZapiService } from '../../infrastructure/services/zapi.service';

export interface NotificacaoAtendente {
  id: string;
  tipo: 'novo_chamado' | 'chamado_finalizado';
  usuario: string;
  telefone: string;
  universidade: string;
  resumoConversa?: string;
  dadosCompletos?: string;
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
  dadosCompletos?: string;
  posicaoAtual: number;
  criadoEm: Date;
  status: 'aguardando' | 'em_atendimento' | 'finalizado';
  atendenteResponsavel?: string;
}

export interface AtendenteConfig {
  nome: string;
  telefone: string;
  universidades: string[];
  maxChamados: number; // Máximo de chamados simultâneos que pode atender
  chamadosAtivos: number; // Contador atual de chamados em atendimento
}

@Injectable()
export class NotificationService {
  constructor(private readonly zapiService: ZapiService) {
    const isProduction = process.env.NODE_ENV === 'production';
    console.log(
      `[NOTIFICATION] Inicializado em modo ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`,
    );
    console.log(
      `[NOTIFICATION] Total de atendentes configurados: ${Object.keys(this.atendentes).length}`,
    );
  }
  // Cache em memória para notificações por telefone do atendente
  private readonly notificacoes = new Map<string, NotificacaoAtendente[]>();

  // Cache em memória para filas por universidade
  private readonly filas = new Map<string, ChamadoFila[]>();

  // Configuração dos atendentes
  private readonly atendentes: Record<string, AtendenteConfig> =
    this.getAtendentesConfig();

  /**
   * Obtém configuração de atendentes baseada no ambiente
   */
  private getAtendentesConfig(): Record<string, AtendenteConfig> {
    // SEMPRE usar atendentes reais do .env
    // Validação de universidade sem atendente será feita no flow
    return this.getAtendentesProducao();
  }

  /**
   * Configuração de atendentes REAIS para produção (via env vars)
   */
  private getAtendentesProducao(): Record<string, AtendenteConfig> {
    const config: Record<string, AtendenteConfig> = {};

    // Isabel Suporte Rade
    const isabelNome = process.env.ATENDENTE_ISABEL_NOME;
    const isabelTelefone = process.env.ATENDENTE_ISABEL_TELEFONE;
    const isabelUnivs = process.env.ATENDENTE_ISABEL_UNIVERSIDADES;

    if (isabelNome && isabelTelefone && isabelUnivs) {
      const isabelUniversidades = isabelUnivs.split(',').map((u) => u.trim());
      isabelUniversidades.forEach((univ) => {
        config[univ] = {
          nome: isabelNome,
          telefone: isabelTelefone,
          universidades: isabelUniversidades,
          maxChamados: 8,
          chamadosAtivos: 0,
        };
      });
    }

    // Kalina assistente Rade
    const kalinaNome = process.env.ATENDENTE_KALINA_NOME;
    const kalinaTelefone = process.env.ATENDENTE_KALINA_TELEFONE;
    const kalinaUnivs = process.env.ATENDENTE_KALINA_UNIVERSIDADES;

    if (kalinaNome && kalinaTelefone && kalinaUnivs) {
      const kalinaUniversidades = kalinaUnivs.split(',').map((u) => u.trim());
      kalinaUniversidades.forEach((univ) => {
        config[univ] = {
          nome: kalinaNome,
          telefone: kalinaTelefone,
          universidades: kalinaUniversidades,
          maxChamados: 6,
          chamadosAtivos: 0,
        };
      });
    }

    // Pamela
    const pamelaNome = process.env.ATENDENTE_PAMELA_NOME;
    const pamelaTelefone = process.env.ATENDENTE_PAMELA_TELEFONE;
    const pamelaUnivs = process.env.ATENDENTE_PAMELA_UNIVERSIDADES;

    if (pamelaNome && pamelaTelefone && pamelaUnivs) {
      const pamelaUniversidades = pamelaUnivs.split(',').map((u) => u.trim());
      pamelaUniversidades.forEach((univ) => {
        config[univ] = {
          nome: pamelaNome,
          telefone: pamelaTelefone,
          universidades: pamelaUniversidades,
          maxChamados: 8,
          chamadosAtivos: 0,
        };
      });
    }

    // Vitória
    const vitoriaNome = process.env.ATENDENTE_VITORIA_NOME;
    const vitoriaTelefone = process.env.ATENDENTE_VITORIA_TELEFONE;
    const vitoriaUnivs = process.env.ATENDENTE_VITORIA_UNIVERSIDADES;

    if (vitoriaNome && vitoriaTelefone && vitoriaUnivs) {
      const vitoriaUniversidades = vitoriaUnivs.split(',').map((u) => u.trim());
      vitoriaUniversidades.forEach((univ) => {
        // Se já existe (Pamela), mantém Pamela como principal
        if (!config[univ]) {
          config[univ] = {
            nome: vitoriaNome,
            telefone: vitoriaTelefone,
            universidades: vitoriaUniversidades,
            maxChamados: 6,
            chamadosAtivos: 0,
          };
        }
      });
    }

    return config;
  }

  /**
   * Configuração de atendentes de TESTE para development/staging
   */
  private getAtendentesTeste(): Record<string, AtendenteConfig> {
    return {
      'Wyden Unifavip': {
        nome: 'Teste Local',
        telefone: '5581996364880', // Seu número para teste
        universidades: [
          'Wyden Unifavip',
          'Centro Universitário Tabosa de Almeida ASCES-UNITA',
        ],
        maxChamados: 5, // Para teste, limite menor
        chamadosAtivos: 0,
      },
      'Centro Universitário Tabosa de Almeida ASCES-UNITA': {
        nome: 'Teste Local',
        telefone: '5581996364880', // Seu número para teste
        universidades: [
          'Wyden Unifavip',
          'Centro Universitário Tabosa de Almeida ASCES-UNITA',
        ],
        maxChamados: 5, // Para teste, limite menor
        chamadosAtivos: 0,
      },
      'Prefeitura de Caruaru': {
        nome: 'Maria Santos',
        telefone: '11666666666',
        universidades: ['Prefeitura de Caruaru'],
        maxChamados: 10, // Para teste, limite maior
        chamadosAtivos: 0,
      },
    };
  }

  /**
   * Adiciona um chamado à fila de uma universidade
   */
  async adicionarChamadoFila(dadosChamado: {
    telefoneUsuario: string;
    nomeUsuario: string;
    universidade: string;
    cpfUsuario: string;
    resumoConversa: string;
    dadosCompletos?: string;
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
      dadosCompletos: dadosChamado.dadosCompletos,
      posicaoAtual: 0, // Será calculado após adicionar à fila
      criadoEm: new Date(),
      status: 'aguardando',
    };

    // Adiciona à fila
    filaUniversidade.push(novoChamado);
    this.filas.set(dadosChamado.universidade, filaUniversidade);

    // Recalcula todas as posições da fila para garantir consistência
    this.recalcularPosicoesFila(dadosChamado.universidade);

    // Envia notificação para atendente
    await this.enviarNotificacaoAtendente(
      dadosChamado.universidade,
      novoChamado,
    );

    console.log(
      `[NOTIFICATION] Chamado adicionado à fila: ${chamadoId} - ${dadosChamado.universidade} - Posição: ${novoChamado.posicaoAtual}`,
    );

    return novoChamado;
  }

  /**
   * Envia notificação para o atendente responsável pela universidade
   */
  private async enviarNotificacaoAtendente(
    universidade: string,
    chamado: ChamadoFila,
  ): Promise<void> {
    const atendente = this.atendentes[universidade];

    if (!atendente) {
      console.warn(
        `[NOTIFICATION] Atendente não encontrado para universidade: ${universidade}`,
      );
      return;
    }

    const notificacao: NotificacaoAtendente = {
      id: `notif_${chamado.id}`,
      tipo: 'novo_chamado',
      usuario: chamado.nomeUsuario,
      telefone: chamado.telefoneUsuario,
      universidade: universidade,
      resumoConversa: chamado.resumoConversa,
      dadosCompletos: chamado.dadosCompletos,
      timestamp: new Date(),
      lida: false,
    };

    // Adiciona notificação à lista do atendente
    const notificacoesAtendente =
      this.notificacoes.get(atendente.telefone) || [];
    notificacoesAtendente.push(notificacao);
    this.notificacoes.set(atendente.telefone, notificacoesAtendente);

    // Envia notificação via WhatsApp se o ZapiService estiver disponível
    if (this.zapiService.isConfigured()) {
      await this.enviarNotificacaoWhatsApp(atendente, chamado);
    }

    console.log(
      `[NOTIFICATION] Notificação enviada para ${atendente.nome} (${atendente.telefone}): ${chamado.nomeUsuario}`,
    );
  }

  /**
   * Envia notificação via WhatsApp para o atendente
   */
  private async enviarNotificacaoWhatsApp(
    atendente: AtendenteConfig,
    chamado: ChamadoFila,
  ): Promise<void> {
    try {
      // Formatação de data e hora em português brasileiro
      const dataHora = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      let mensagem = `🚨 NOVO CHAMADO - ${chamado.universidade}\n\n`;

      if (chamado.dadosCompletos) {
        mensagem += chamado.dadosCompletos;
      } else {
        mensagem += `👤 ${chamado.nomeUsuario}\n📞 ${chamado.telefoneUsuario}`;
      }

      // Adiciona data e hora do pedido de ajuda
      mensagem += `\n\n🕐 SOLICITADO EM: ${dataHora}`;

      await this.zapiService.sendWhatsAppMessage(
        `whatsapp:+${atendente.telefone}`,
        mensagem,
      );

      console.log(
        `[NOTIFICATION] Notificação WhatsApp enviada para ${atendente.nome}`,
      );
    } catch (error) {
      console.error(
        `[NOTIFICATION] Erro ao enviar notificação WhatsApp para ${atendente.nome}:`,
        error,
      );
    }
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
  marcarNotificacaoLida(
    telefoneAtendente: string,
    notificacaoId: string,
  ): boolean {
    const notificacoes = this.notificacoes.get(telefoneAtendente) || [];
    const notificacao = notificacoes.find((n) => n.id === notificacaoId);

    if (notificacao) {
      notificacao.lida = true;
      return true;
    }

    return false;
  }

  /**
   * Remove notificação
   */
  removerNotificacao(
    telefoneAtendente: string,
    notificacaoId: string,
  ): boolean {
    const notificacoes = this.notificacoes.get(telefoneAtendente) || [];
    const index = notificacoes.findIndex((n) => n.id === notificacaoId);

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
    const atendenteData = Object.values(this.atendentes).find(
      (a) => a.telefone === telefoneAtendente,
    );

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
    const chamadosOrdenados = todosChamados.sort(
      (a, b) => a.criadoEm.getTime() - b.criadoEm.getTime(),
    );

    // Recalcula posições considerando todas as universidades do atendente como uma fila única
    const chamadosAguardando = chamadosOrdenados.filter(
      (c) => c.status === 'aguardando',
    );
    chamadosAguardando.forEach((chamado, index) => {
      chamado.posicaoAtual = index + 1;
    });

    return chamadosOrdenados;
  }

  /**
   * Atende um chamado específico
   * IMPORTANTE: Verifica se o atendente não ultrapassou o limite de chamados simultâneos
   */
  async atenderChamado(
    chamadoId: string,
    telefoneAtendente: string,
  ): Promise<{ success: boolean; message: string; chamado?: ChamadoFila }> {
    // Encontra o chamado em qualquer fila
    let chamadoEncontrado: ChamadoFila | null = null;
    let universidadeChamado: string | null = null;

    for (const [universidade, fila] of this.filas.entries()) {
      const chamado = fila.find((c) => c.id === chamadoId);
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
      return {
        success: false,
        message: 'Chamado já está sendo atendido ou foi finalizado',
      };
    }

    // Verifica se o atendente pode assumir mais chamados
    const atendente = this.atendentes[universidadeChamado!];
    if (atendente && atendente.chamadosAtivos >= atendente.maxChamados) {
      return {
        success: false,
        message: `Limite de ${atendente.maxChamados} chamados simultâneos atingido`,
      };
    }

    // Atualiza status do chamado
    chamadoEncontrado.status = 'em_atendimento';
    chamadoEncontrado.atendenteResponsavel = telefoneAtendente;

    // Incrementa contador de chamados ativos do atendente
    if (atendente) {
      atendente.chamadosAtivos++;
    }

    // Remove notificação correspondente
    this.removerNotificacao(telefoneAtendente, `notif_${chamadoId}`);

    // Recalcula posições da fila
    this.recalcularPosicoesFila(universidadeChamado!);

    console.log(
      `[NOTIFICATION] Chamado ${chamadoId} foi assumido por atendente ${telefoneAtendente}`,
    );

    return {
      success: true,
      message: 'Chamado assumido com sucesso',
      chamado: chamadoEncontrado,
    };
  }

  /**
   * Finaliza um chamado
   * IMPORTANTE: Decrementa o contador de chamados ativos do atendente
   */
  async finalizarChamado(
    chamadoId: string,
    telefoneAtendente: string,
  ): Promise<{ success: boolean; message: string }> {
    // Encontra o chamado
    let chamadoEncontrado: ChamadoFila | null = null;
    let universidadeChamado: string | null = null;

    for (const [universidade, fila] of this.filas.entries()) {
      const index = fila.findIndex((c) => c.id === chamadoId);
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
      return {
        success: false,
        message: 'Você não é responsável por este chamado',
      };
    }

    // Decrementa contador de chamados ativos do atendente
    const atendente = this.atendentes[universidadeChamado!];
    if (atendente && atendente.chamadosAtivos > 0) {
      atendente.chamadosAtivos--;
    }

    // Recalcula posições da fila
    this.recalcularPosicoesFila(universidadeChamado!);

    console.log(
      `[NOTIFICATION] Chamado ${chamadoId} foi finalizado por atendente ${telefoneAtendente}`,
    );

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
      const chamadosAguardando = fila.filter((c) => c.status === 'aguardando');
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
  getPosicaoUsuarioFila(
    telefoneUsuario: string,
  ): { posicao: number; universidade: string } | null {
    for (const [universidade, fila] of this.filas.entries()) {
      const chamado = fila.find(
        (c) =>
          c.telefoneUsuario === telefoneUsuario && c.status === 'aguardando',
      );
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
    const totalChamados = Array.from(this.filas.values()).reduce(
      (total, fila) => total + fila.length,
      0,
    );
    const chamadosAguardando = Array.from(this.filas.values()).reduce(
      (total, fila) => {
        return total + fila.filter((c) => c.status === 'aguardando').length;
      },
      0,
    );
    const chamadosEmAtendimento = Array.from(this.filas.values()).reduce(
      (total, fila) => {
        return total + fila.filter((c) => c.status === 'em_atendimento').length;
      },
      0,
    );

    return {
      totalChamados,
      chamadosAguardando,
      chamadosEmAtendimento,
      filasPorUniversidade: Object.fromEntries(
        Array.from(this.filas.entries()).map(([univ, fila]) => [
          univ,
          {
            total: fila.length,
            aguardando: fila.filter((c) => c.status === 'aguardando').length,
            emAtendimento: fila.filter((c) => c.status === 'em_atendimento')
              .length,
          },
        ]),
      ),
    };
  }
}
