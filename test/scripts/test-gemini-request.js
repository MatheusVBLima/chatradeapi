require('dotenv').config();

const { google } = require('@ai-sdk/google');
const { streamText, tool } = require('ai');
const { jsonSchema } = require('@ai-sdk/provider-utils');

const modelName = process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.1-flash-lite';
const model = google(modelName);

const schema = jsonSchema({
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Mensagem para ecoar' },
  },
  required: ['query'],
});

const tools = {
  echo: tool({
    description: 'Retorna a mensagem recebida para validar tool calling.',
    inputSchema: schema,
    execute: async ({ query }) => ({ echoed: query }),
  }),
};

(async () => {
  console.log(`Testing Gemini request with ${modelName}`);

  const result = await streamText({
    model,
    system: 'Use a ferramenta echo e depois responda em uma frase curta.',
    messages: [{ role: 'user', content: 'Teste rapido de tool calling' }],
    tools,
    maxRetries: 0,
  });

  const text = await result.text;
  console.log('Response:', text);
})().catch((error) => {
  console.error('Gemini request failed:', error?.data || error);
  process.exit(1);
});
