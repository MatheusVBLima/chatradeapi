const { tool, jsonSchema } = require('ai');
const { google } = require('@ai-sdk/google');

// Simular o que está sendo feito
const schema = jsonSchema({
  type: 'object',
  properties: { test: { type: 'string' } },
  required: ['test']
});

console.log('=== Creating tool with jsonSchema ===');
const toolCorrect = tool({ 
  description: 'test tool', 
  parameters: schema, 
  execute: async (args) => ({ result: 'success' })
});

console.log('Tool parameters:', JSON.stringify(toolCorrect.parameters, null, 2));

// Check what would be sent to Gemini
const model = google('gemini-2.0-flash');
console.log('\n=== Checking how tool is structured for API ===');
console.log('toolCorrect keys:', Object.keys(toolCorrect));
console.log('Full tool:', JSON.stringify(toolCorrect, (k, v) => {
  if (typeof v === 'function') return '[Function]';
  return v;
}, 2));
