const { tool, jsonSchema } = require('ai');

const schema = jsonSchema({
  type: 'object',
  properties: { test: { type: 'string' } },
  required: ['test']
});

console.log('=== jsonSchema() returns ===');
console.log('schema:', JSON.stringify(schema, null, 2));

console.log('\n=== Passing to tool() ===');
const t1 = tool({ 
  description: 'test', 
  parameters: schema, 
  execute: async (args) => args 
});

console.log('tool.parameters:', JSON.stringify(t1.parameters, null, 2));

console.log('\n=== Passing raw object (WRONG) ===');
const rawJson = { 
  type: 'object', 
  properties: { test: { type: 'string' } }, 
  required: ['test'] 
};
const t2 = tool({ 
  description: 'test', 
  parameters: rawJson, 
  execute: async (args) => args 
});

console.log('tool.parameters (raw):', JSON.stringify(t2.parameters, null, 2));
