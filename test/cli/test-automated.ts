import axios from 'axios';

const API_URL = 'http://127.0.0.1:3001/chat/hybrid';
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

class AutomatedTester {
  private state: TestState | null = null;

  async sendMessage(message: string): Promise<string> {
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

    const { response: botResponse, success, error, nextState } = response.data;

    if (!success) {
      throw new Error(`Erro: ${error}`);
    }

    this.state = nextState || null;
    return botResponse;
  }

  async runTests(): Promise<void> {
    if (!TEST_CPF || !TEST_PHONE) {
      throw new Error('Defina TEST_CHAT_CPF e TEST_CHAT_PHONE para rodar este teste.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🧪 TESTE AUTOMATIZADO - CHAT HÍBRIDO');
    console.log('='.repeat(80) + '\n');

    // Sequência de mensagens para teste
    const testSequence = [
      { msg: 'Olá', desc: 'Iniciar conversa' },
      { msg: '2', desc: 'Selecionar coordenador' },
      { msg: TEST_CPF, desc: 'Enviar CPF' },
      { msg: TEST_PHONE, desc: 'Enviar telefone' },
      { msg: '5', desc: 'Selecionar Atendente Virtual (IA)' },

      // Testes da IA - Lote 3
      { msg: 'me mostra os dados do jairo e do luis felipe', desc: 'Teste 7: Duas pessoas específicas' },
      { msg: 'tenho algum profissional?', desc: 'Teste 8: Profissionais' },
      { msg: 'quem é você?', desc: 'Teste 9: Pergunta fora do escopo RADE' },
    ];

    for (const test of testSequence) {
      console.log(`\n📤 [${test.desc}]`);
      console.log(`   VOCÊ: ${test.msg}`);

      try {
        const response = await this.sendMessage(test.msg);
        console.log(`   💬 BOT: ${response.substring(0, 500)}${response.length > 500 ? '...' : ''}`);
      } catch (error: any) {
        console.error(`   ❌ ERRO: ${error.message}`);
      }

      // Pequena pausa entre mensagens
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TESTES CONCLUÍDOS');
    console.log('='.repeat(80) + '\n');
  }
}

async function main() {
  const tester = new AutomatedTester();
  await tester.runTests();
}

main().catch(console.error);
