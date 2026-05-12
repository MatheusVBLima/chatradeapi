import axios from 'axios';
import * as readline from 'readline';

const API_URL = process.env.CHAT_TEST_OPEN_URL || 'http://localhost:3001/chat/test_open';
const TEST_CPF = process.env.TEST_CHAT_CPF;
const TEST_PHONE = process.env.TEST_CHAT_PHONE;

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

class InteractiveOpenChatTester {
  private state: TestState | null = null;
  private readonly rl: readline.Interface;
  private readonly conversationHistory: Array<{ role: 'user' | 'bot'; message: string }> = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async sendMessage(message: string): Promise<void> {
    try {
      this.conversationHistory.push({ role: 'user', message });

      const payload: any = {
        message,
        environment: 'web',
      };

      if (this.state) {
        payload.state = this.state;
      }

      const response = await axios.post<TestResponse>(API_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      const {
        response: botResponse,
        success,
        error,
        nextState,
      } = response.data;

      if (!success) {
        console.error(`\nErro: ${error}\n`);
        return;
      }

      this.state = nextState || null;
      this.conversationHistory.push({ role: 'bot', message: botResponse });

      console.log(`\nIA: ${botResponse}\n`);
      if (this.state) {
        console.log(`Estado: ${this.state.currentState}\n`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`\nErro na requisicao: ${error.message}`);
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Dados: ${JSON.stringify(error.response.data)}\n`);
        }
      } else {
        console.error('\nErro desconhecido:', error);
      }
    }
  }

  async start(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('CHAT INTERATIVO - IA OPEN RADE (TESTE)');
    console.log('='.repeat(80));
    console.log(`URL: ${API_URL}`);
    console.log('\nComandos:');
    console.log('   quit/exit  encerra');
    console.log('   reset      reinicia a conversa');
    console.log('   historico  mostra o historico local');
    console.log('\nFluxo web: informe CPF, telefone e depois faca perguntas para a IA.');
    console.log('='.repeat(80) + '\n');

    await this.sendMessage('Ola');

    if (process.env.TEST_OPEN_AUTO === 'true') {
      await this.runAutomatedSmokeTest();
      return;
    }

    if (!process.stdin.isTTY) {
      await this.runPipedInput();
      return;
    }

    this.promptUser();
  }

  private async runPipedInput(): Promise<void> {
    for await (const input of this.rl) {
      const message = input.trim();

      if (!message) {
        continue;
      }

      if (message.toLowerCase() === 'quit' || message.toLowerCase() === 'exit') {
        this.close();
        return;
      }

      await this.sendMessage(message);
    }
  }

  private async runAutomatedSmokeTest(): Promise<void> {
    if (!TEST_CPF || !TEST_PHONE) {
      throw new Error(
        'Defina TEST_CHAT_CPF e TEST_CHAT_PHONE para rodar TEST_OPEN_AUTO=true.',
      );
    }

    const messages = [
      TEST_CPF,
      TEST_PHONE,
      'Quais sao meus dados de coordenadora?',
      'Gere um relatorio em PDF com meus dados de coordenadora',
    ];

    for (const message of messages) {
      console.log(`VOCE: ${message}`);
      await this.sendMessage(message);
    }

    this.close();
  }

  private promptUser(): void {
    this.rl.question('VOCE: ', async (input) => {
      const message = input.trim();

      if (message.toLowerCase() === 'quit' || message.toLowerCase() === 'exit') {
        this.close();
        process.exit(0);
        return;
      }

      if (message.toLowerCase() === 'reset') {
        this.state = null;
        this.conversationHistory.length = 0;
        console.log('\nConversa reiniciada.\n');
        await this.sendMessage('Ola');
        this.promptUser();
        return;
      }

      if (message.toLowerCase() === 'historico') {
        this.showHistory();
        this.promptUser();
        return;
      }

      if (!message) {
        console.log('Digite uma mensagem.\n');
        this.promptUser();
        return;
      }

      await this.sendMessage(message);
      this.promptUser();
    });
  }

  private showHistory(): void {
    if (this.conversationHistory.length === 0) {
      console.log('\nHistorico vazio.\n');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('HISTORICO DA CONVERSA');
    console.log('='.repeat(80) + '\n');

    this.conversationHistory.forEach((entry) => {
      const label = entry.role === 'user' ? 'VOCE' : 'IA';
      console.log(`${label}: ${entry.message}\n`);
    });
  }

  close(): void {
    this.rl.close();
  }
}

async function main() {
  const tester = new InteractiveOpenChatTester();
  await tester.start();
}

process.on('SIGINT', () => {
  console.log('\nChat encerrado.\n');
  process.exit(0);
});

main().catch((error) => {
  console.error('\nErro ao iniciar o chat:', error);
  process.exit(1);
});
