import axios from 'axios';
import * as readline from 'readline';

// Configuração
const API_URL = 'http://localhost:3001/chat/hybrid';

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

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async sendMessage(message: string): Promise<void> {
    try {
      const response = await axios.post<TestResponse>(
        API_URL,
        {
          message,
          state: this.state,
          environment: 'web', // Ambiente mobile test - pede telefone
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const { response: botResponse, success, error, nextState } = response.data;

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
    console.log('\n' + '='.repeat(80));
    console.log('🤖 CHAT INTERATIVO - FLUXO HÍBRIDO RADE');
    console.log('='.repeat(80));
    console.log('\n📌 Dicas:');
    console.log('   - Digite suas mensagens normalmente');
    console.log('   - Digite "quit" ou "exit" para sair');
    console.log('   - Digite "reset" para reiniciar a conversa');
    console.log('   - Use CPF e telefone reais cadastrados para testar autenticação\n');
    console.log('='.repeat(80) + '\n');

    // Inicia a conversa
    await this.sendMessage('Olá');

    // Loop de interação
    this.promptUser();
  }

  private promptUser(): void {
    this.rl.question('📤 VOCÊ: ', async (input) => {
      const message = input.trim();

      // Comandos especiais
      if (message.toLowerCase() === 'quit' || message.toLowerCase() === 'exit') {
        console.log('\n👋 Encerrando chat. Até logo!\n');
        this.rl.close();
        process.exit(0);
        return;
      }

      if (message.toLowerCase() === 'reset') {
        this.state = null;
        console.log('\n🔄 Conversa reiniciada!\n');
        await this.sendMessage('Olá');
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
        console.log('\n💡 A conversa foi encerrada. Digite "reset" para começar novamente ou "quit" para sair.\n');
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
