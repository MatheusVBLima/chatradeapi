import axios from 'axios';
import * as readline from 'readline';

// Configuração
const API_URL = 'http://localhost:3001/chat/test_open';

interface TestResponse {
  response: string;
  success: boolean;
  error?: string;
}

class InteractiveChatTester {
  private rl: readline.Interface;
  private conversationHistory: Array<{ role: 'user' | 'bot'; message: string }> = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async sendMessage(message: string): Promise<void> {
    try {
      // Adiciona mensagem do usuário ao histórico
      this.conversationHistory.push({ role: 'user', message });

      const response = await axios.post<TestResponse>(
        API_URL,
        {
          message,
          environment: 'web', // Ambiente web - sempre pede telefone
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const { response: botResponse, success, error } = response.data;

      if (!success) {
        console.error(`\n❌ Erro: ${error}\n`);
        return;
      }

      // Adiciona resposta do bot ao histórico
      this.conversationHistory.push({ role: 'bot', message: botResponse });

      // Exibe resposta do bot
      console.log(`\n🤖 IA: ${botResponse}\n`);

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
    console.log('🤖 CHAT INTERATIVO - IA OPEN RADE (TESTE)');
    console.log('='.repeat(80));
    console.log('\n📌 Dicas:');
    console.log('   - Digite suas mensagens normalmente');
    console.log('   - Digite "quit" ou "exit" para sair');
    console.log('   - Digite "reset" para reiniciar a conversa');
    console.log('   - Digite "historico" para ver o histórico da conversa');
    console.log('   - Este é um chat com IA sem menu estruturado\n');
    console.log('='.repeat(80) + '\n');

    console.log('💡 Chat iniciado! Você pode fazer qualquer pergunta sobre o sistema RADE.\n');

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
        this.conversationHistory = [];
        console.log('\n🔄 Conversa reiniciada! Histórico limpo.\n');
        this.promptUser();
        return;
      }

      if (message.toLowerCase() === 'historico') {
        this.showHistory();
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

      // Continua o loop
      this.promptUser();
    });
  }

  private showHistory(): void {
    if (this.conversationHistory.length === 0) {
      console.log('\n📜 Histórico vazio.\n');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📜 HISTÓRICO DA CONVERSA');
    console.log('='.repeat(80) + '\n');

    this.conversationHistory.forEach((entry, index) => {
      const icon = entry.role === 'user' ? '👤' : '🤖';
      const label = entry.role === 'user' ? 'VOCÊ' : 'IA';
      console.log(`${icon} ${label}: ${entry.message}\n`);
    });

    console.log('='.repeat(80) + '\n');
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
