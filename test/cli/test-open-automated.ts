import axios from 'axios';

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

class AutomatedOpenChatTester {
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
      timeout: 120000,
    });

    const {
      response: botResponse,
      success,
      error,
      nextState,
    } = response.data;

    if (!success) {
      throw new Error(error || 'Resposta sem sucesso');
    }

    this.state = nextState || null;
    return botResponse;
  }

  async run(): Promise<void> {
    if (!TEST_CPF || !TEST_PHONE) {
      throw new Error('Defina TEST_CHAT_CPF e TEST_CHAT_PHONE para rodar este teste.');
    }

    const sequence = [
      { msg: 'Ola', desc: 'Iniciar conversa' },
      { msg: TEST_CPF, desc: 'Informar CPF da coordenadora' },
      { msg: TEST_PHONE, desc: 'Informar telefone da coordenadora' },
      {
        msg: 'Quais sao meus dados de coordenadora?',
        desc: 'Gerar resposta da IA com tool de coordenador',
      },
      {
        msg: 'Gere um relatorio em PDF com meus dados de coordenadora',
        desc: 'Gerar relatorio pela IA',
      },
    ];

    console.log('\n' + '='.repeat(80));
    console.log('TESTE AUTOMATIZADO - CHAT OPEN COM IA');
    console.log('='.repeat(80));
    console.log(`URL: ${API_URL}`);
    console.log(`CPF: ${TEST_CPF}`);
    console.log(`Telefone: ${TEST_PHONE}`);
    console.log('='.repeat(80) + '\n');

    for (const test of sequence) {
      console.log(`[${test.desc}]`);
      console.log(`VOCE: ${test.msg}`);

      const response = await this.sendMessage(test.msg);
      console.log(`IA: ${response.substring(0, 1200)}${response.length > 1200 ? '...' : ''}`);
      console.log(`Estado: ${this.state?.currentState || 'null'}\n`);
    }

    if (this.state?.currentState !== 'AUTHENTICATED') {
      throw new Error(`Estado final inesperado: ${this.state?.currentState || 'null'}`);
    }

    console.log('Teste automatizado concluido.');
  }
}

async function main() {
  await new AutomatedOpenChatTester().run();
}

main().catch((error) => {
  console.error('\nFalha no teste automatizado:', error.message || error);
  process.exit(1);
});
