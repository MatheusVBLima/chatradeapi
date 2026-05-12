const { tool } = require('ai');
const { jsonSchema } = require('@ai-sdk/provider-utils');

const schema = jsonSchema({
  type: 'object',
  properties: {
    test: { type: 'string' },
  },
  required: ['test'],
});

console.log('=== jsonSchema() returns ===');
console.log(JSON.stringify(schema, null, 2));

console.log('\n=== Passing JSON Schema to AI SDK v5 tool() ===');
const sdkTool = tool({
  description: 'test',
  inputSchema: schema,
  execute: async (args) => args,
});

console.log(
  JSON.stringify(
    sdkTool,
    (_key, value) => (typeof value === 'function' ? '[Function]' : value),
    2,
  ),
);
