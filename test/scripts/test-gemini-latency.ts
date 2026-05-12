import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

const primaryModelName = process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.1-flash-lite';
const fallbackModelName = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

async function timeModel(modelName: string): Promise<void> {
  const start = Date.now();
  const result = await streamText({
    model: google(modelName) as any,
    messages: [
      {
        role: 'user',
        content: 'Responda apenas: ok',
      },
    ],
    temperature: 0,
    maxRetries: 0,
  });

  const text = await result.text;
  const elapsedMs = Date.now() - start;
  console.log(`${modelName}: ${elapsedMs}ms - ${text.trim()}`);
}

async function main() {
  console.log('Testing Gemini latency');
  await timeModel(primaryModelName);

  if (fallbackModelName !== primaryModelName) {
    await timeModel(fallbackModelName);
  }
}

main().catch((error) => {
  console.error('Latency test failed:', error?.data || error);
  process.exit(1);
});
