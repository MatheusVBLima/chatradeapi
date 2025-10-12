import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { google } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';
import { z } from 'zod';
import { VirtualAssistanceService } from '../../domain/services/virtual-assistance.service';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: string;
  error?: string;
}

interface DiagnosticReport {
  serverInfo: {
    location: string;
    nodeVersion: string;
    platform: string;
    timezone: string;
    timestamp: string;
  };
  tests: TestResult[];
  summary: {
    successRate: string;
    avgDuration: number;
    totalDuration: number;
    diagnosis: string;
    recommendations?: string[];
  };
}

@ApiTags('Debug')
@Controller('debug')
export class DebugLatencyController {
  constructor(
    private readonly configService: ConfigService,
    @Inject('VirtualAssistanceService')
    private readonly virtualAssistanceService: VirtualAssistanceService,
  ) {
    // Set API key for Google AI
    process.env.GOOGLE_GENERATIVE_AI_API_KEY =
      this.configService.get<string>('GOOGLE_GENERATIVE_AI_API_KEY');
  }

  @Get('test-latency')
  @ApiOperation({
    summary: 'Test Gemini API latency from this server',
    description:
      'Runs 4 diagnostic tests to measure latency and identify issues with Google Gemini API connection. Use this to compare Render (Virginia) vs Vultr (São Paulo) performance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnostic tests completed',
  })
  async testLatency(): Promise<DiagnosticReport> {
    const results: TestResult[] = [];

    // Server information
    const serverInfo = {
      location: this.detectServerLocation(),
      nodeVersion: process.version,
      platform: process.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
    };

    console.log('[LATENCY-TEST] Starting diagnostic tests...');

    // Run all tests
    results.push(await this.testBasicLatency());
    await this.sleep(1000);

    results.push(await this.testToolCallingLatency());
    await this.sleep(1000);

    results.push(await this.testMultiStepLatency());
    await this.sleep(1000);

    results.push(await this.testStreamingVsNonStreaming());

    // Calculate summary
    const successCount = results.filter((r) => r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = Math.round(totalDuration / results.length);

    // Generate diagnosis
    const { diagnosis, recommendations } = this.generateDiagnosis(
      results,
      avgDuration,
      successCount,
    );

    console.log(
      `[LATENCY-TEST] Completed. Success rate: ${successCount}/${results.length}`,
    );

    return {
      serverInfo,
      tests: results,
      summary: {
        successRate: `${successCount}/${results.length}`,
        avgDuration,
        totalDuration,
        diagnosis,
        recommendations,
      },
    };
  }

  private detectServerLocation(): string {
    const renderRegion = process.env.RENDER_REGION;
    if (renderRegion) {
      return `Render (${renderRegion})`;
    }

    // Try to detect by timezone or other env vars
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.includes('America/Sao_Paulo') || timezone.includes('Fortaleza')) {
      return 'Brazil (likely Vultr São Paulo)';
    } else if (timezone.includes('New_York') || timezone.includes('Virginia')) {
      return 'USA East Coast (likely Virginia)';
    }

    return `Unknown (${timezone})`;
  }

  private async testBasicLatency(): Promise<TestResult> {
    const model = google('gemini-2.5-flash-lite');
    const startTime = Date.now();

    try {
      const result = await streamText({
        model: model as any,
        prompt: 'Say "Hello" in one word',
        maxRetries: 0,
        temperature: 0,
      });

      let textReceived = '';
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          textReceived += chunk.text;
        }
      }

      const duration = Date.now() - startTime;
      const usage = await result.usage;

      console.log(
        `[LATENCY-TEST] Test 1 (Basic): ${duration}ms - "${textReceived}"`,
      );

      return {
        testName: 'Basic Latency',
        success: true,
        duration,
        details: `Text: "${textReceived}", Tokens: ${usage?.totalTokens || 0}`,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[LATENCY-TEST] Test 1 failed: ${error.message}`);

      return {
        testName: 'Basic Latency',
        success: false,
        duration,
        details: 'Failed to connect',
        error: error.message,
      };
    }
  }

  private async testToolCallingLatency(): Promise<TestResult> {
    const model = google('gemini-2.5-flash-lite');
    const startTime = Date.now();

    const { tool } = require('ai');

    const mockTool = tool({
      description: 'Get user data',
      parameters: z.object({
        userId: z.string(),
      }),
      execute: async ({ userId }: { userId: string }) => {
        return {
          name: 'Test User',
          email: 'test@example.com',
          id: userId,
        };
      },
    });

    try {
      const result = await streamText({
        model: model as any,
        prompt: 'Get data for user 123',
        tools: {
          getUserData: mockTool,
        },
        maxRetries: 0,
        temperature: 0,
      });

      let textReceived = '';
      let toolCallCount = 0;

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          textReceived += chunk.text;
        } else if (chunk.type === 'tool-call') {
          toolCallCount++;
        }
      }

      const duration = Date.now() - startTime;

      console.log(
        `[LATENCY-TEST] Test 2 (Tool Calling): ${duration}ms - Tools: ${toolCallCount}, Text: ${textReceived.length} chars`,
      );

      return {
        testName: 'Tool Calling Latency',
        success: true,
        duration,
        details: `Tools: ${toolCallCount}, Text: ${textReceived.length} chars`,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[LATENCY-TEST] Test 2 failed: ${error.message}`);

      return {
        testName: 'Tool Calling Latency',
        success: false,
        duration,
        details: 'Failed during tool execution',
        error: error.message,
      };
    }
  }

  private async testMultiStepLatency(): Promise<TestResult> {
    const model = google('gemini-2.5-flash-lite');
    const startTime = Date.now();

    const { tool } = require('ai');
    const { stepCountIs } = require('ai');

    const mockTool = tool({
      description: 'Get coordinator data from RADE API',
      parameters: z.object({
        cpf: z.string(),
      }),
      execute: async ({ cpf }: { cpf: string }) => {
        // Try to get real data from RADE API (simulates production)
        try {
          const coordinatorData =
            await this.virtualAssistanceService.getCoordinatorInfo(cpf);
          return coordinatorData;
        } catch {
          // Fallback to mock data if API fails
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {
            coordinatorName: 'João Silva',
            coordinatorEmail: 'joao@example.com',
            coordinatorPhone: '11999999999',
            groupNames: ['Grupo A', 'Grupo B'],
          };
        }
      },
    });

    try {
      const result = await streamText({
        model: model as any,
        messages: [
          {
            role: 'user',
            content: 'Quais os meus dados? Meu CPF é 07448080490',
          },
        ],
        system:
          'Você DEVE chamar a ferramenta getCoordinatorData com o CPF fornecido. NUNCA responda sem chamar a ferramenta primeiro. Após receber os dados da ferramenta, responda em português formatando os dados recebidos.',
        tools: {
          getCoordinatorData: mockTool,
        },
        stopWhen: stepCountIs(5),
        maxRetries: 0,
        temperature: 0,
        onStepFinish: ({ text, toolCalls, finishReason, usage }: any) => {
          console.log(
            `[LATENCY-TEST] Test 3 Step - Text: ${text?.length || 0} chars, Tools: ${toolCalls?.length || 0}, Reason: ${finishReason}, OutputTokens: ${usage?.outputTokens || 'undefined'}`,
          );
        },
      });

      let textReceived = '';
      let toolCallCount = 0;

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          textReceived += chunk.text;
        } else if (chunk.type === 'tool-call') {
          toolCallCount++;
        }
      }

      const completeText = await result.text;
      const duration = Date.now() - startTime;

      // CRITICAL CHECK: Did tool execute but no text generated?
      const hasCriticalIssue = toolCallCount > 0 && completeText.length === 0;

      console.log(
        `[LATENCY-TEST] Test 3 (Multi-Step): ${duration}ms - Tools: ${toolCallCount}, Text: ${completeText.length} chars${hasCriticalIssue ? ' ⚠️ CRITICAL ISSUE!' : ''}`,
      );

      if (hasCriticalIssue) {
        return {
          testName: 'Multi-Step Latency',
          success: false,
          duration,
          details: `Tools: ${toolCallCount}, Text: ${completeText.length} chars`,
          error: 'No text generated after tool execution - THIS IS THE VULTR ISSUE!',
        };
      }

      return {
        testName: 'Multi-Step Latency',
        success: completeText.length > 0,
        duration,
        details: `Tools: ${toolCallCount}, Text: ${completeText.length} chars`,
        error:
          completeText.length === 0
            ? 'No text generated after tool execution'
            : undefined,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[LATENCY-TEST] Test 3 failed: ${error.message}`);

      return {
        testName: 'Multi-Step Latency',
        success: false,
        duration,
        details: 'Failed during multi-step execution',
        error: error.message,
      };
    }
  }

  private async testStreamingVsNonStreaming(): Promise<TestResult> {
    const model = google('gemini-2.5-flash-lite');
    const prompt = 'Explique em 2 frases o que é inteligência artificial';

    try {
      // Test streaming
      const streamStart = Date.now();
      const streamResult = await streamText({
        model: model as any,
        prompt,
        maxRetries: 0,
      });

      let streamTextContent = '';
      for await (const chunk of streamResult.fullStream) {
        if (chunk.type === 'text-delta') {
          streamTextContent += chunk.text;
        }
      }

      const streamDuration = Date.now() - streamStart;

      // Test non-streaming
      const nonStreamStart = Date.now();
      const nonStreamResult = await generateText({
        model: model as any,
        prompt,
        maxRetries: 0,
      });

      const nonStreamDuration = Date.now() - nonStreamStart;

      const difference = streamDuration - nonStreamDuration;
      const percentDiff = ((difference / nonStreamDuration) * 100).toFixed(1);

      console.log(
        `[LATENCY-TEST] Test 4 (Streaming vs Non): Stream ${streamDuration}ms, Non-stream ${nonStreamDuration}ms, Diff ${difference}ms (${percentDiff}%)`,
      );

      return {
        testName: 'Streaming vs Non-Streaming',
        success: true,
        duration: streamDuration,
        details: `Stream: ${streamDuration}ms, Non-stream: ${nonStreamDuration}ms, Diff: ${difference}ms (${percentDiff}%)`,
      };
    } catch (error: any) {
      console.error(`[LATENCY-TEST] Test 4 failed: ${error.message}`);
      return {
        testName: 'Streaming vs Non-Streaming',
        success: false,
        duration: 0,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private generateDiagnosis(
    results: TestResult[],
    avgDuration: number,
    successCount: number,
  ): { diagnosis: string; recommendations?: string[] } {
    const multiStepResult = results.find(
      (r) => r.testName === 'Multi-Step Latency',
    );

    // Check for the critical Vultr issue
    if (
      multiStepResult &&
      !multiStepResult.success &&
      multiStepResult.error?.includes('No text generated')
    ) {
      return {
        diagnosis:
          '⚠️ CONFIRMED: Multi-step tool execution fails to generate text! This is the EXACT issue happening in Vultr production.',
        recommendations: [
          'Increase timeout (currently no explicit timeout)',
          'Add retry with non-streaming mode',
          'Improve fallback to extract text from tool results',
          'Consider migrating to Vertex AI (regionalized endpoint)',
        ],
      };
    }

    // Check for high latency
    if (avgDuration > 5000) {
      return {
        diagnosis:
          '⚠️ High latency detected (avg > 5s). This may cause timeouts in production streaming.',
        recommendations: [
          'Increase streaming timeout to 120s',
          'Use Vertex AI with southamerica-east1 region',
          'Add connection pooling/keep-alive optimization',
        ],
      };
    }

    // All tests passed with good latency
    if (successCount === results.length && avgDuration < 3000) {
      return {
        diagnosis:
          '✅ All tests passed with good latency! API connection is healthy on this server.',
      };
    }

    // Mixed results
    return {
      diagnosis:
        '⚠️ Some tests failed or had mixed results. Review individual test errors.',
      recommendations: [
        'Check firewall rules for generativelanguage.googleapis.com',
        'Verify DNS resolution',
        'Test HTTPS connectivity to Google services',
      ],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
