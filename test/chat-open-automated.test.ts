import axios from 'axios';

interface TestCase {
  name: string;
  userId: string;
  userRole: string;
  message: string;
  expectedBehavior: string;
  shouldContain?: string[];
  shouldNotContain?: string[];
  shouldAskQuestion?: boolean;
}

interface TestResult {
  testName: string;
  passed: boolean;
  response: string;
  errors: string[];
}

const API_URL = 'http://localhost:3001/chat/open';

// Dados esperados baseados no todo.md
const EXPECTED_DATA = {
  alice: {
    cpf: '55443322100',
    groups: ['Grupo 1 - Saúde da Mulher', 'Grupo 4 - Saúde Mental'],
    canAccessOngoing: false, // ESTUDANTES NÃO podem acessar atividades em andamento
    scheduledActivities: ['Coleta de Preventivo'], // Apenas Grupo 1 (não há atividades do Grupo 4)
    professionals: ['Dr. João Carlos Oliveira', 'Dra. Larissa Melo', 'Dr. João Mendes'] // Grupos 1 e 4
  },
  bruno: {
    cpf: '44332211099',
    groups: ['Grupo 2 - Saúde da Família'],
    canAccessOngoing: false, // ESTUDANTES NÃO podem acessar atividades em andamento
    scheduledActivities: ['Atendimento Individual com Educador'], // Agora TEM atividade do Grupo 2
    professionals: ['Dra. Maria Eduarda Silva', 'Dr. Ricardo Silva', 'Dra. Ana Paula Teixeira', 'Dra. Carla Souza'] // Todos do Grupo 2
  },
  camila: {
    cpf: '33221100988',
    groups: ['Grupo 3 - Saúde da Criança', 'Grupo 5 - Saúde do Idoso'],
    canAccessOngoing: false, // ESTUDANTES NÃO podem acessar atividades em andamento
    scheduledActivities: ['Consulta Pediátrica Supervisionada'], // Grupo 3
    professionals: ['Dr. Rafael Costa Lima', 'Dra. Fernanda Costa', 'Dr. Marcelo Pinheiro', 'Dr. Paulo Henrique'] // Grupos 3 e 5
  },
  coordenador: {
    cpf: '111.111.111-11',
    role: 'coordinator',
    allOngoingActivities: ['Visita Domiciliar', 'Atendimento Ambulatorial', 'Roda de Conversa'],
    allStudents: ['Alice Ferreira', 'Bruno Lima', 'Camila Rocha']
  }
};

const TEST_CASES: TestCase[] = [
  // Testes de ambiguidade - IA deve explicar que só pode mostrar agendadas
  {
    name: 'Alice pergunta genericamente sobre atividades - deve explicar limitações',
    userId: EXPECTED_DATA.alice.cpf,
    userRole: 'student',
    message: 'quero ver minhas atividades',
    expectedBehavior: 'Explicar que só pode mostrar atividades agendadas para estudantes',
    shouldContain: ['agendadas']
  },
  
  // Testes específicos para Alice
  {
    name: 'Alice pede atividades em andamento - deve negar acesso',
    userId: EXPECTED_DATA.alice.cpf,
    userRole: 'student',
    message: 'quero ver minhas atividades em andamento',
    expectedBehavior: 'Negar acesso - apenas coordenadores podem ver atividades em andamento',
    shouldContain: ['estudante', 'agendadas'],
    shouldNotContain: ['Visita Domiciliar', 'Grupo 4']
  },
  
  {
    name: 'Alice pede atividades agendadas - deve retornar apenas Grupo 1',
    userId: EXPECTED_DATA.alice.cpf,
    userRole: 'student',
    message: 'quero ver minhas atividades agendadas',
    expectedBehavior: 'Retornar apenas atividades do Grupo 1 (Coleta de Preventivo)',
    shouldContain: ['Coleta de Preventivo', 'Saúde da Mulher'],
    shouldNotContain: ['Consulta Pediátrica', 'Atendimento Individual', 'Grupo 3', 'Grupo 2']
  },
  
  {
    name: 'Alice pede seus profissionais - deve retornar apenas dos grupos 1 e 4',
    userId: EXPECTED_DATA.alice.cpf,
    userRole: 'student',
    message: 'quem são meus preceptores',
    expectedBehavior: 'Retornar apenas profissionais dos Grupos 1 e 4',
    shouldContain: ['Dr. João Carlos Oliveira', 'Dra. Larissa Melo', 'Dr. João Mendes'],
    shouldNotContain: ['Dra. Maria Eduarda Silva', 'Dr. Rafael Costa Lima']
  },
  
  // Testes para Bruno
  {
    name: 'Bruno pede atividades agendadas - deve retornar Grupo 2',
    userId: EXPECTED_DATA.bruno.cpf,
    userRole: 'student',
    message: 'Meu CPF é 44332211099, quais minhas atividades futuras',
    expectedBehavior: 'Retornar atividade do Grupo 2 - Saúde da Família',
    shouldContain: ['Atendimento Individual', 'Saúde da Família'],
    shouldNotContain: ['Consulta Pediátrica', 'Coleta de Preventivo']
  },
  
  {
    name: 'Bruno pede seus profissionais - deve retornar apenas Grupo 2',
    userId: EXPECTED_DATA.bruno.cpf,
    userRole: 'student',
    message: 'quero ver meus preceptores',
    expectedBehavior: 'Retornar apenas profissionais do Grupo 2',
    shouldContain: ['Maria Eduarda Silva', 'Ricardo Silva', 'Ana Paula Teixeira'],
    shouldNotContain: ['João Carlos Oliveira', 'Rafael Costa Lima']
  },
  
  // Testes para Camila
  {
    name: 'Camila pede atividades agendadas - deve retornar apenas Grupo 3',
    userId: EXPECTED_DATA.camila.cpf,
    userRole: 'student',
    message: 'minhas atividades programadas',
    expectedBehavior: 'Retornar apenas atividades do Grupo 3',
    shouldContain: ['Consulta Pediátrica Supervisionada', 'Saúde da Criança'],
    shouldNotContain: ['Coleta de Preventivo', 'Atendimento Individual']
  },
  
  // Testes para Coordenador
  {
    name: 'Coordenador pergunta genericamente sobre atividades - deve perguntar tipo',
    userId: EXPECTED_DATA.coordenador.cpf,
    userRole: 'coordinator',
    message: 'quero ver as atividades',
    expectedBehavior: 'Perguntar se quer atividades em andamento ou agendadas dos estudantes',
    shouldAskQuestion: true,
    shouldContain: ['em andamento', 'agendadas']
  },
  
  {
    name: 'Coordenador pede atividades em andamento - deve retornar todas',
    userId: EXPECTED_DATA.coordenador.cpf,
    userRole: 'coordinator',
    message: 'mostre as atividades em andamento dos estudantes',
    expectedBehavior: 'Retornar todas as atividades em andamento',
    shouldContain: ['Alice Ferreira', 'Bruno Lima', 'Camila Rocha', 'Visita Domiciliar', 'Atendimento Ambulatorial', 'Roda de Conversa']
  }
];

async function runTest(testCase: TestCase): Promise<TestResult> {
  const result: TestResult = {
    testName: testCase.name,
    passed: false,
    response: '',
    errors: []
  };

  try {
    console.log(`\n🧪 Executando: ${testCase.name}`);
    console.log(`👤 Usuário: ${testCase.userId} (${testCase.userRole})`);
    console.log(`💬 Mensagem: "${testCase.message}"`);
    
    const response = await axios.post(API_URL, {
      message: testCase.message,
      userId: testCase.userId,
      channel: 'web'
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const { response: apiResponse, success } = response.data;
    result.response = apiResponse;

    if (!success) {
      result.errors.push('API retornou success: false');
      return result;
    }

    // Verificar se deve fazer pergunta
    if (testCase.shouldAskQuestion) {
      const isAsking = testCase.shouldContain?.some(keyword => 
        apiResponse.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (!isAsking) {
        result.errors.push(`Deveria perguntar sobre tipo de atividade, mas não perguntou. Palavras esperadas: ${testCase.shouldContain?.join(', ')}`);
      }
    }

    // Verificar conteúdo que deve estar presente
    if (testCase.shouldContain) {
      for (const keyword of testCase.shouldContain) {
        if (!apiResponse.toLowerCase().includes(keyword.toLowerCase())) {
          result.errors.push(`Deveria conter "${keyword}" mas não contém`);
        }
      }
    }

    // Verificar conteúdo que NÃO deve estar presente
    if (testCase.shouldNotContain) {
      for (const keyword of testCase.shouldNotContain) {
        if (apiResponse.toLowerCase().includes(keyword.toLowerCase())) {
          result.errors.push(`NÃO deveria conter "${keyword}" mas contém`);
        }
      }
    }

    result.passed = result.errors.length === 0;

    // Log do resultado
    if (result.passed) {
      console.log(`✅ PASSOU`);
    } else {
      console.log(`❌ FALHOU`);
      result.errors.forEach(error => console.log(`   🔸 ${error}`));
    }
    
    console.log(`📝 Resposta: "${apiResponse.substring(0, 100)}..."`);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      result.errors.push(`Erro HTTP: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    } else {
      result.errors.push(`Erro inesperado: ${error}`);
    }
    console.log(`💥 ERRO: ${result.errors[0]}`);
  }

  return result;
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Iniciando testes automatizados do Chat Open');
  console.log('📋 Baseado nos dados mockados do todo.md');
  console.log(`🔗 Testando endpoint: ${API_URL}`);
  console.log('=' .repeat(80));

  const results: TestResult[] = [];
  
  for (const testCase of TEST_CASES) {
    const result = await runTest(testCase);
    results.push(result);
    
    // Pausa entre testes para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Relatório final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RELATÓRIO FINAL DOS TESTES');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passou: ${passed}/${results.length}`);
  console.log(`❌ Falhou: ${failed}/${results.length}`);
  console.log(`📈 Taxa de sucesso: ${Math.round((passed / results.length) * 100)}%`);
  
  if (failed > 0) {
    console.log('\n🔍 TESTES QUE FALHARAM:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`\n❌ ${result.testName}`);
      result.errors.forEach(error => console.log(`   🔸 ${error}`));
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(passed === results.length ? '🎉 TODOS OS TESTES PASSARAM!' : '🚨 ALGUNS TESTES FALHARAM!');
  console.log('='.repeat(80));
}

// Executar testes
runAllTests().catch(console.error);