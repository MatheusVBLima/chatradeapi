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

export interface ChamadoNotificacao {
  id: string;
  telefoneUsuario: string;
  nomeUsuario: string;
  universidade: string;
  cpfUsuario: string;
  resumoConversa: string;
  dadosCompletos?: string;
  criadoEm: Date;
}

export interface AtendenteConfig {
  nome: string;
  telefone: string;
  universidades: string[];
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
          };
        }
      });
    }

    // Matheus (SEU_NOME)
    const seuNomeNome = process.env.ATENDENTE_SEU_NOME_NOME;
    const seuNomeTelefone = process.env.ATENDENTE_SEU_NOME_TELEFONE;
    const seuNomeUnivs = process.env.ATENDENTE_SEU_NOME_UNIVERSIDADES;

    if (seuNomeNome && seuNomeTelefone && seuNomeUnivs) {
      const seuNomeUniversidades = seuNomeUnivs.split(',').map((u) => u.trim());
      seuNomeUniversidades.forEach((univ) => {
        if (!config[univ]) {
          config[univ] = {
            nome: seuNomeNome,
            telefone: seuNomeTelefone,
            universidades: seuNomeUniversidades,
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
      'Centro Universitário Tabosa de Almeida ASCES-UNITA': {
        nome: 'Teste Local',
        telefone: '5581996364880',
        universidades: ['Centro Universitário Tabosa de Almeida ASCES-UNITA'],
      },
      'Prefeitura de Caruaru': {
        nome: 'Maria Santos',
        telefone: '11666666666',
        universidades: ['Prefeitura de Caruaru'],
      },
    };
  }

  /**
   * Envia notificação de chamado para atendente
   */
  async enviarNotificacaoChamado(dadosChamado: {
    telefoneUsuario: string;
    nomeUsuario: string;
    universidade: string;
    cpfUsuario: string;
    resumoConversa: string;
    dadosCompletos?: string;
  }): Promise<ChamadoNotificacao> {
    const chamadoId = `chamado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const novoChamado: ChamadoNotificacao = {
      id: chamadoId,
      telefoneUsuario: dadosChamado.telefoneUsuario,
      nomeUsuario: dadosChamado.nomeUsuario,
      universidade: dadosChamado.universidade,
      cpfUsuario: dadosChamado.cpfUsuario,
      resumoConversa: dadosChamado.resumoConversa,
      dadosCompletos: dadosChamado.dadosCompletos,
      criadoEm: new Date(),
    };

    // Envia notificação para atendente
    await this.enviarNotificacaoAtendente(
      dadosChamado.universidade,
      novoChamado,
    );

    console.log(
      `[NOTIFICATION] Notificação enviada: ${chamadoId} - ${dadosChamado.universidade}`,
    );

    return novoChamado;
  }

  /**
   * Envia notificação para o atendente responsável pela universidade
   */
  private async enviarNotificacaoAtendente(
    universidade: string,
    chamado: ChamadoNotificacao,
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
    chamado: ChamadoNotificacao,
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
}
