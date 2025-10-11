const axios = require('axios');

// Simula o fluxo completo de teste com os dados fornecidos
async function testarFluxoCompleto() {
  const baseUrl = 'http://localhost:3001';
  let state = null;

  console.log('🚀 Iniciando teste do fluxo completo...\n');

  try {
    // 1. Iniciar conversa
    console.log('1️⃣ Iniciando conversa...');
    let response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: 'Oi',
      state: null,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    state = response.data.nextState;
    console.log('');

    // 2. Escolher "Sou Estudante"
    console.log('2️⃣ Escolhendo "Sou Estudante"...');
    response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: '1',
      state: state,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    state = response.data.nextState;
    console.log('');

    // 3. Informar CPF de teste
    console.log('3️⃣ Informando CPF de teste...');
    response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: '98765432100',
      state: state,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    state = response.data.nextState;
    console.log('');

    // 4. Informar telefone (validação CPF + telefone)
    console.log(
      '4️⃣ Informando telefone para autenticação (vinculado ao CPF)...',
    );
    response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: '11999999999',
      state: state,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    state = response.data.nextState;
    console.log('');

    // 5. Escolher "Como fazer meu cadastro"
    console.log('5️⃣ Escolhendo "Como fazer meu cadastro"...');
    response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: '1',
      state: state,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    state = response.data.nextState;
    console.log('');

    // 6. Escolher "Não, preciso de mais ajuda"
    console.log('6️⃣ Escolhendo "Não, preciso de mais ajuda"...');
    response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: '2',
      state: state,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    state = response.data.nextState;
    console.log('');

    // 7. Informar telefone para transferência
    console.log('7️⃣ Informando telefone para transferência ao atendente...');
    response = await axios.post(`${baseUrl}/chat/test_hybrid`, {
      message: '81996364880',
      state: state,
      environment: 'web',
    });

    console.log('Bot:', response.data.response);
    console.log('');

    console.log(
      '✅ Teste concluído! Verifique se você recebeu a notificação no WhatsApp.',
    );
  } catch (error) {
    console.error(
      '❌ Erro durante o teste:',
      error.response?.data || error.message,
    );
  }
}

// Executar o teste
testarFluxoCompleto();
