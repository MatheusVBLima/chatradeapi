import axios from 'axios';
import * as readline from 'readline';

// ========================================
// 🔧 CONFIGURAÇÃO - MUDE APENAS A URL AQUI
// ========================================
const API_URL = 'http://127.0.0.1:3001/chat/hybrid';
// Use 'http://localhost:8080' se estiver usando túnel SSH
// Use 'http://216.238.123.241' para acesso direto ao servidor
// Exemplos de URLs para testar:
//
// PRODUÇÃO (validação completa CPF+Telefone):
// - 'http://216.238.123.241/chat/open'         → Chat aberto com IA (pede CPF + telefone)
// - 'http://216.238.123.241/chat/closed'       → Chat fechado (menu, pede CPF + telefone)
// - 'http://216.238.123.241/chat/hybrid'       → Chat híbrido (menu + IA, pede CPF + telefone)
//
// TESTE (mock/staging, validação simplificada):
// - 'http://216.238.123.241/chat/test_open'    → Test open (IA)
// - 'http://216.238.123.241/chat/test_closed'  → Test closed (menu)
// - 'http://216.238.123.241/chat/test_hybrid'  → Test hybrid (menu + IA)

interface TestState {
  currentState: string;
  data: any;
}

interface TestResponse {
  response: string;
  success: boolean;
  error?: string;
  nextState?: TestState | null;
}

class InteractiveChatTester {
  private state: TestState | null = null;
  private rl: readline.Interface;
  private userId: string = ''; // Para rotas que precisam de userId

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async sendMessage(message: string): Promise<void> {
    try {
      // Monta o payload baseado na rota
      const payload: any = {
        message,
        environment: 'web',
      };

      // Adiciona state se existir (para fluxos com estado)
      if (this.state) {
        payload.state = this.state;
      }

      // Adiciona userId se definido (para /chat/open, /test/api, etc)
      if (this.userId) {
        payload.userId = this.userId;
      }

      const response = await axios.post<TestResponse>(API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const {
        response: botResponse,
        success,
        error,
        nextState,
      } = response.data;

      if (!success) {
        console.error(`\n❌ Erro: ${error}\n`);
        return;
      }

      // Atualiza o estado
      this.state = nextState || null;

      // Exibe resposta do bot
      console.log(`\n💬 BOT: ${botResponse}\n`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`\n❌ Erro na requisição: ${error.message}`);
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Dados: ${JSON.stringify(error.response.data)}\n`);
        }
      } else {
        console.error(`\n❌ Erro desconhecido:`, error);
      }
    }
  }

  async start(): Promise<void> {
    // Detecta o tipo de rota baseado na URL
    const routeType = this.detectRouteType(API_URL);

    console.log('\n' + '='.repeat(80));
    console.log(`🤖 CHAT INTERATIVO - ${routeType.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(`📍 URL: ${API_URL}`);
    console.log('\n📌 Dicas:');
    console.log('   - Digite suas mensagens normalmente');
    console.log('   - Digite "quit" ou "exit" para sair');
    console.log('   - Digite "reset" para reiniciar a conversa');
    console.log('   - Digite "status" para ver o estado atual');

    if (API_URL.includes('/hybrid') || API_URL.includes('/closed')) {
      console.log('   - Use números para selecionar opções do menu');
    }

    if (
      API_URL.includes('/hybrid') ||
      API_URL.includes('/open') ||
      API_URL.includes('/api')
    ) {
      console.log('   - O sistema pedirá CPF e telefone durante a conversa');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Inicia a conversa
    await this.sendMessage('Olá');

    // Loop de interação
    this.promptUser();
  }

  private detectRouteType(url: string): string {
    if (url.includes('/chat/open')) return 'Chat Aberto (Produção)';
    if (url.includes('/chat/closed')) return 'Chat Fechado (Produção)';
    if (url.includes('/chat/hybrid')) return 'Chat Híbrido (Produção)';
    if (url.includes('/test/open')) return 'Chat Aberto (Teste)';
    if (url.includes('/test/closed')) return 'Chat Fechado (Teste)';
    if (url.includes('/test/api')) return 'API Test (Conectividade)';
    return 'Chat Genérico';
  }

  private promptUser(): void {
    this.rl.question('📤 VOCÊ: ', async (input) => {
      const message = input.trim();

      // Comandos especiais
      if (
        message.toLowerCase() === 'quit' ||
        message.toLowerCase() === 'exit'
      ) {
        console.log('\n👋 Encerrando chat. Até logo!\n');
        this.rl.close();
        process.exit(0);
        return;
      }

      if (message.toLowerCase() === 'reset') {
        this.state = null;
        this.userId = '';
        console.log('\n🔄 Conversa reiniciada!\n');
        await this.sendMessage('Olá');
        this.promptUser();
        return;
      }

      // Comando para definir userId (útil para /chat/open, /test/api)
      if (message.toLowerCase().startsWith('setuser ')) {
        const cpf = message.substring(8).trim();
        this.userId = cpf;
        console.log(`\n✅ userId definido como: ${cpf}\n`);
        this.promptUser();
        return;
      }

      // Comando para ver o estado atual
      if (message.toLowerCase() === 'status') {
        console.log(`\n📊 Status atual:`);
        console.log(`   - URL: ${API_URL}`);
        console.log(`   - UserId: ${this.userId || 'não definido'}`);
        console.log(`   - State: ${this.state?.currentState || 'null'}\n`);
        this.promptUser();
        return;
      }

      if (!message) {
        console.log('⚠️  Por favor, digite uma mensagem.\n');
        this.promptUser();
        return;
      }

      // Envia mensagem
      await this.sendMessage(message);

      // Verifica se o chat foi encerrado
      if (!this.state || this.state.currentState === 'END') {
        console.log(
          '\n💡 A conversa foi encerrada. Digite "reset" para começar novamente ou "quit" para sair.\n',
        );
      }

      // Continua o loop
      this.promptUser();
    });
  }

  close(): void {
    this.rl.close();
  }
}

// Função principal
async function main() {
  const tester = new InteractiveChatTester();

  try {
    await tester.start();
  } catch (error) {
    console.error('\n💥 Erro ao iniciar o chat:', error);
    process.exit(1);
  }
}

// Tratamento de encerramento
process.on('SIGINT', () => {
  console.log('\n\n👋 Chat encerrado. Até logo!\n');
  process.exit(0);
});

// Executar
main();
