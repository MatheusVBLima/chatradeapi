import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from '@ai-sdk/google';
import { streamText, type CoreMessage, type ToolCallPart } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { z } from 'zod';
import { User } from '../../domain/entities/user.entity';
import { AIService } from '../../domain/services/ai.service';
import { VirtualAssistanceService } from '../../domain/services/virtual-assistance.service';
import { randomUUID } from 'crypto';
import { CacheService } from '../../application/services/cache.service';
import { PromptService } from './prompt.service';
import {
  MetricsService,
  ChatMetric,
} from '../../application/services/metrics.service';

@Injectable()
export class GeminiAIService implements AIService {
  private readonly primaryModel: LanguageModelV2;
  private readonly fallbackModel: LanguageModelV2;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('VirtualAssistanceService')
    private readonly virtualAssistanceService: VirtualAssistanceService,
    private readonly cacheService: CacheService,
    private readonly promptService: PromptService,
    private readonly metricsService: MetricsService,
  ) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = this.configService.get<string>(
      'GOOGLE_GENERATIVE_AI_API_KEY',
    );
    this.primaryModel = google('gemini-2.5-flash-lite');
    this.fallbackModel = google('gemini-2.0-flash'); // 2.0 não tem versão -lite na docs oficial
    const configuredBaseUrl = this.configService.get<string>('API_BASE_URL');
    const renderExternalUrl = process.env.RENDER_EXTERNAL_URL;
    this.apiBaseUrl =
      configuredBaseUrl || renderExternalUrl || 'http://localhost:3001';
  }

  // Método mantido apenas para compatibilidade com process-api-chat-message.use-case.ts
  async generateResponse(
    userMessage: string,
    userData: User | User[],
  ): Promise<string> {
    return 'Este endpoint está descontinuado. Por favor, use o chat open (/chat/open) que possui todas as funcionalidades atualizadas.';
  }

  // Helper method to call streamText with fallback
  private async callStreamTextWithFallback(params: {
    system: string;
    messages: CoreMessage[];
    tools?: Record<string, any>;
  }): Promise<any> {
    const { system, messages, tools } = params;

    // Try primary model first (sem retry interno - faremos nosso próprio fallback)
    try {
      console.log('[AI] Attempting with primary model (gemini-2.5-flash-lite)');
      return await streamText({
        model: this.primaryModel as any,
        system,
        messages,
        tools,
        maxRetries: 0, // Desabilitar retry automático do AI SDK
        experimental_telemetry: { isEnabled: false },
      });
    } catch (error: any) {
      console.log('[AI] Primary model failed, analyzing error...', error?.name);
      // Check if it's a 503/overload error (check nested error objects too)
      const errorMessage = JSON.stringify(error);
      const isOverloadError =
        errorMessage.includes('overloaded') ||
        errorMessage.includes('503') ||
        errorMessage.includes('UNAVAILABLE') ||
        error?.statusCode === 503 ||
        error?.lastError?.statusCode === 503 ||
        error?.data?.error?.code === 503 ||
        error?.data?.error?.status === 'UNAVAILABLE';

      console.log('[AI] Is overload error?', isOverloadError);

      if (isOverloadError) {
        console.log(
          '[AI] Primary model overloaded, falling back to gemini-2.5-flash-lite',
        );
        try {
          return await streamText({
            model: this.fallbackModel as any,
            system,
            messages,
            tools,
            maxRetries: 2, // No fallback, permitir 2 retries
            experimental_telemetry: { isEnabled: false },
          });
        } catch (fallbackError) {
          console.error('[AI] Both models failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        // For non-overload errors, just throw the original error
        throw error;
      }
    }
  }

  // ✅ NOVO: Adiciona execute functions dinamicamente nas tools
  // Isso permite que o AI SDK execute as tools automaticamente com maxSteps
  private addExecuteFunctionsToTools(
    tools: Record<string, any>,
    cpf: string,
  ): Record<string, any> {
    const { tool } = require('ai');
    const toolsWithExecute: Record<string, any> = {};

    for (const [toolName, toolDef] of Object.entries(tools)) {
      // Criar nova tool com execute function
      toolsWithExecute[toolName] = tool({
        description: (toolDef as any).description,
        parameters: (toolDef as any).parameters,
        execute: async (args: any) => {
          // ✅ Injetar CPF automaticamente se não estiver presente
          const argsWithCpf = { ...args };
          if (!argsWithCpf.cpf) {
            argsWithCpf.cpf = cpf;
          }

          console.log(
            `[AI-SDK5] Auto-executing tool: ${toolName}`,
            argsWithCpf,
          );

          // Executar a tool usando a lógica existente do executeTool
          return await this.executeTool({
            toolName,
            args: argsWithCpf,
            toolCallId: `auto-${Date.now()}`,
          });
        },
      });
    }

    return toolsWithExecute;
  }

  async processToolCall(
    actor: User,
    userMessage: string,
    availableTools: Record<string, any>,
    maxToolDepth: number = 3,
    conversationHistory: Array<{ role: string; content: any }> = [],
  ): Promise<{
    text: string;
    messages: Array<{ role: string; content: any }>;
  }> {
    const startTime = Date.now();
    console.log(
      '[AI-SDK5] processToolCall called with:',
      actor.cpf,
      userMessage,
    );

    // 1. Usar histórico passado ou buscar do cache como fallback
    const conversationKey = `conversation_${actor.cpf}`;
    let existingMessages: CoreMessage[] = [];

    if (conversationHistory && conversationHistory.length > 0) {
      // Converter histórico do flow para formato CoreMessage
      existingMessages = conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
      console.log(
        '[AI-SDK5] Using conversation history from flow:',
        existingMessages.length,
        'messages',
      );
    } else {
      // Fallback: buscar do cache
      existingMessages = this.cacheService.get(conversationKey) || [];
      console.log(
        '[AI-SDK5] Using conversation history from cache:',
        existingMessages.length,
        'messages',
      );
    }

    // 2. Adicionar nova mensagem do usuário
    const messages: CoreMessage[] = [
      ...existingMessages,
      { role: 'user', content: userMessage },
    ];

    // 3. Limitar histórico (últimas mensagens) - com preservação inteligente
    // IMPORTANTE: Não podemos cortar muito senão quebramos a sequência válida do Gemini
    const trimmedMessages = this.smartTrimMessages(messages, 20);

    // Debug: Ver estrutura das mensagens
    console.log(
      '[AI-SDK5] Trimmed messages preview:',
      JSON.stringify(trimmedMessages.slice(-2), null, 2).substring(0, 500),
    );

    // 4. ✅ NOVO: Adicionar execute functions nas tools
    const toolsWithExecute = this.addExecuteFunctionsToTools(
      availableTools,
      actor.cpf,
    );

    // Métricas de tokens
    const systemPrompt = this.promptService.getSystemPrompt(actor);
    const estimatedInputTokens =
      this.estimateTokens(systemPrompt) +
      trimmedMessages.reduce(
        (acc, msg) => acc + this.estimateTokens(JSON.stringify(msg.content)),
        0,
      );

    console.log('[METRICS] Estimated input tokens:', estimatedInputTokens);
    console.log(
      '[METRICS] Available tools:',
      Object.keys(toolsWithExecute).length,
    );
    console.log('[METRICS] Message history length:', trimmedMessages.length);

    let result;
    let usedFallback = false;

    // 5. ✅ Usando maxSteps para permitir tool execution + text generation
    try {
      console.log(
        `[AI-SDK5] Calling streamText (v5 auto-handles tool execution)`,
      );
      result = await streamText({
        model: this.primaryModel as any,
        system: systemPrompt,
        messages: trimmedMessages,
        tools: toolsWithExecute, // ✅ Tools com execute functions
        temperature: 0,
        maxRetries: 0,
        experimental_telemetry: { isEnabled: false },
        onStepFinish: ({
          text,
          toolCalls,
          toolResults,
          finishReason,
          usage,
        }) => {
          console.log('[AI-SDK5] onStepFinish:', {
            textLength: text?.length || 0,
            toolCallsCount: toolCalls?.length || 0,
            toolResultsCount: toolResults?.length || 0,
            finishReason,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
          });
        },
      });
    } catch (primaryError: any) {
      console.error(
        '[AI] Primary model failed during stream, trying fallback...',
        primaryError?.name,
      );

      // Detectar erro de overload
      const errorMessage = JSON.stringify(primaryError);
      const isOverloadError =
        errorMessage.includes('overloaded') ||
        errorMessage.includes('503') ||
        errorMessage.includes('UNAVAILABLE') ||
        primaryError?.statusCode === 503 ||
        primaryError?.data?.error?.code === 503;

      if (isOverloadError) {
        console.log('[AI-SDK5] Overload detected, using fallback model');
        usedFallback = true;

        // Tentar com modelo fallback
        result = await streamText({
          model: this.fallbackModel as any,
          system: systemPrompt,
          messages: trimmedMessages,
          tools: toolsWithExecute, // ✅ Tools com execute functions (AI SDK 5.0 executa automaticamente)
          temperature: 0.1,
          maxRetries: 2,
          experimental_telemetry: { isEnabled: false },
          onStepFinish: ({
            text,
            toolCalls,
            toolResults,
            finishReason,
            usage,
          }) => {
            console.log('[AI-SDK5-FALLBACK] onStepFinish:', {
              textLength: text?.length || 0,
              toolCallsCount: toolCalls?.length || 0,
              toolResultsCount: toolResults?.length || 0,
              finishReason,
            });
          },
        });
      } else {
        throw primaryError;
      }
    }

    // 6. ✅ SIMPLIFICADO: Processar stream (AI SDK já executou todas as tools!)
    let finalText = '';
    let toolCallsCount = 0;

    try {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          finalText += part.text;
        } else if (part.type === 'tool-call') {
          toolCallsCount++;
          console.log(`[AI-SDK5] Tool called: ${part.toolName}`);
        } else if (part.type === 'tool-result') {
          console.log(`[AI-SDK5] Tool result received for: ${part.toolName}`);
        } else if (part.type === 'step-finish') {
          console.log(`[AI-SDK5] Step ${part.stepNumber} finished`);
        } else if (part.type === 'error') {
          console.error(`[AI-SDK5] Stream error:`, part.error);

          if ((part.error as any)?.name === 'AI_NoSuchToolError') {
            const errorMsg =
              'Desculpe, não posso te ajudar com essa questão. Posso ajudá-lo com informações sobre seus dados acadêmicos, atividades ou preceptores da plataforma RADE.';
            return {
              text: errorMsg,
              messages: [
                ...trimmedMessages,
                { role: 'assistant', content: errorMsg },
              ],
            };
          }

          throw new Error(`Stream error: ${JSON.stringify(part.error)}`);
        }
      }
    } catch (error) {
      console.error(`[AI-SDK5] Error reading stream:`, error);
      throw error;
    }

    console.log(
      `[AI-SDK5] Stream complete. Text length: ${finalText.length}, Tools called: ${toolCallsCount}`,
    );

    // ✅ Aguardar o result.text completo (pode não estar no stream ainda)
    const completeText = await result.text;
    console.log(`[AI-SDK5] Complete text length: ${completeText.length}`);
    console.log(`[AI-SDK5] Complete text content: "${completeText}"`);

    // Usar completeText se finalText estiver vazio
    const responseText = finalText || completeText;

    if (!responseText || responseText.trim().length === 0) {
      console.warn(
        '[AI-SDK5] Empty response after tool execution! Making second call for final response...',
      );

      // ✅ CRITICAL FIX: result.steps é uma Promise, precisa fazer await!
      const steps = await result.steps;
      console.log('[AI-SDK5] Steps resolved, length:', steps?.length || 0);

      // ✅ SOLUÇÃO CORRETA PARA GEMINI: Adicionar mensagem do usuário pedindo formatação
      try {
        // Debug: verificar o que está em result.response
        console.log(
          '[AI-SDK5] result.response?.messages length:',
          result.response?.messages?.length || 0,
        );

        // ✅ CORREÇÃO: Usar result.response.messages diretamente (já no formato correto)
        // NÃO construir manualmente - AI SDK 5 já retorna no formato correto
        const messagesWithToolResults = [
          ...trimmedMessages,
          ...(result.response?.messages || []),
        ];

        console.log(
          '[AI-SDK5] Second call with',
          messagesWithToolResults.length,
          'messages (original:',
          trimmedMessages.length,
          '+ response:',
          result.response?.messages?.length || 0,
          ')',
        );
        console.log(
          '[AI-SDK5] Response messages roles:',
          (result.response?.messages || []).map((m: any) => m.role).join(', '),
        );

        // ✅ SOLUÇÃO PARA GEMINI: Adicionar mensagem do usuário solicitando resposta formatada
        // (NÃO usar mensagem assistant vazia - isso é específico do Claude)
        const messagesForCompletion = [
          ...messagesWithToolResults,
          {
            role: 'user' as const,
            content:
              'Com base nos dados que você obteve, forneça uma resposta clara e formatada para minha pergunta.',
          },
        ];

        // ⚠️ CORREÇÃO: Incluir tools na segunda chamada para permitir generateReport
        // O Gemini pode precisar executar generateReport após buscar os dados
        const secondResult = await streamText({
          model: this.primaryModel as any,
          system: systemPrompt,
          messages: messagesForCompletion,
          tools: toolsWithExecute, // ✅ Incluir tools para permitir generateReport (AI SDK 5.0 executa automaticamente)
          temperature: 0.3, // ⚠️ Aumentar temperatura para forçar geração de texto ao invés de reexecutar tools
          maxRetries: 0,
          experimental_telemetry: { isEnabled: false },
        });

        console.log('[AI-SDK5] Second call with tools enabled');

        let secondText = '';
        for await (const part of secondResult.fullStream) {
          if (part.type === 'text-delta') {
            secondText += part.text;
          }
        }

        console.log(
          '[AI-SDK5] Second call generated text length:',
          secondText.length,
        );

        if (secondText && secondText.length > 0) {
          const secondResponse = await secondResult.response;
          const messagesWithResponse = [
            ...trimmedMessages,
            ...(secondResponse?.messages || [
              { role: 'assistant', content: secondText },
            ]),
          ];
          return {
            text: secondText,
            messages: messagesWithResponse,
          };
        }

        // ✅ CRÍTICO: Se segunda chamada não gerou texto, verificar se executou tools
        console.log('[AI-SDK5] Second call did not generate text, checking for tool results...');
        const secondSteps = await secondResult.steps;
        console.log('[AI-SDK5] Second call steps:', secondSteps?.length || 0);

        if (secondSteps && secondSteps.length > 0) {
          const lastSecondStep: any = secondSteps[secondSteps.length - 1];

          if (lastSecondStep?.toolResults && lastSecondStep.toolResults.length > 0) {
            console.log('[AI-SDK5] Second call has tool results, building response...');

            const secondToolResults = lastSecondStep.toolResults.map((tr: any) => ({
              toolName: tr.toolName,
              result: tr.result || tr.output || tr,
            }));

            // ⚠️ CRÍTICO: Verificar se usuário pediu relatório mas generateReport não foi executado
            const userWantsReport = /relat[óo]rio|pdf|csv|txt|exportar|download|gerar arquivo|gere um pdf/i.test(userMessage);
            const hasGenerateReportTool = secondToolResults.some((tr: any) => tr.toolName === 'generateReport');

            if (userWantsReport && !hasGenerateReportTool) {
              console.log('[AI-SDK5] User requested report but generateReport was not executed, making third call...');

              // Fazer terceira chamada para forçar execução de generateReport
              try {
                const secondResponse = await secondResult.response;
                const messagesAfterSecond = [
                  ...trimmedMessages,
                  ...(secondResponse?.messages || []),
                ];

                console.log('[AI-SDK5] Third call with', messagesAfterSecond.length, 'messages');

                const thirdResult = await streamText({
                  model: usedFallback ? (this.fallbackModel as any) : (this.primaryModel as any),
                  system: systemPrompt,
                  messages: messagesAfterSecond,
                  tools: toolsWithExecute,
                  temperature: 0.1,
                  maxRetries: 2,
                  experimental_telemetry: { isEnabled: false },
                });

                let thirdText = '';
                for await (const part of thirdResult.fullStream) {
                  if (part.type === 'text-delta') {
                    thirdText += part.text;
                  } else if (part.type === 'tool-call') {
                    console.log(`[AI-SDK5-THIRD] Tool called: ${part.toolName}`);
                  }
                }

                console.log('[AI-SDK5] Third call generated text length:', thirdText.length);

                if (thirdText && thirdText.trim().length > 0) {
                  console.log('[AI-SDK5] Using third call text response');
                  const thirdResponse = await thirdResult.response;
                  return {
                    text: thirdText,
                    messages: [
                      ...messagesAfterSecond,
                      ...(thirdResponse?.messages || []),
                    ],
                  };
                }

                // Se terceira chamada também não gerou texto, verificar tool results
                const thirdSteps = await thirdResult.steps;
                if (thirdSteps && thirdSteps.length > 0) {
                  const lastThirdStep: any = thirdSteps[thirdSteps.length - 1];
                  if (lastThirdStep?.toolResults && lastThirdStep.toolResults.length > 0) {
                    console.log('[AI-SDK5] Third call has tool results');
                    const thirdToolResults = lastThirdStep.toolResults.map((tr: any) => ({
                      toolName: tr.toolName,
                      result: tr.result || tr.output || tr,
                    }));

                    const thirdFallbackResponse = this.buildFallbackResponseFromToolResults(
                      thirdToolResults,
                      userMessage,
                    );

                    if (thirdFallbackResponse && thirdFallbackResponse.length > 10) {
                      const thirdResponse = await thirdResult.response;
                      return {
                        text: thirdFallbackResponse,
                        messages: [
                          ...messagesAfterSecond,
                          ...(thirdResponse?.messages || []),
                          { role: 'assistant', content: thirdFallbackResponse },
                        ],
                      };
                    }
                  }
                }
              } catch (thirdCallError) {
                console.error('[AI-SDK5] Third call failed:', thirdCallError);
              }
            }

            const secondFallbackResponse = this.buildFallbackResponseFromToolResults(
              secondToolResults,
              userMessage,
            );

            if (secondFallbackResponse && secondFallbackResponse.length > 10) {
              console.log('[AI-SDK5] Using second call fallback response');

              const secondResponse = await secondResult.response;
              const messagesWithToolResults = [
                ...trimmedMessages,
                ...(secondResponse?.messages || []),
                { role: 'assistant', content: secondFallbackResponse },
              ];

              return {
                text: secondFallbackResponse,
                messages: messagesWithToolResults,
              };
            }
          }
        }
      } catch (secondCallError) {
        console.error('[AI-SDK5] Second call failed:', secondCallError);
      }

      // Usar buildFallbackResponseFromToolResults se tiver tool results
      if (steps && steps.length > 0) {
        console.log('[AI-SDK5] Checking steps for tool results...');
        const lastStep: any = steps[steps.length - 1];

        if (lastStep?.toolResults && lastStep.toolResults.length > 0) {
          console.log(
            '[AI-SDK5] Found tool results, building fallback response',
          );
          console.log(
            '[AI-SDK5] Raw toolResults structure:',
            JSON.stringify(lastStep.toolResults).substring(0, 500),
          );

          const toolResults = lastStep.toolResults.map((tr: any) => ({
            toolName: tr.toolName,
            result: tr.result || tr.output || tr, // Tentar diferentes propriedades
          }));

          const fallbackResponse = this.buildFallbackResponseFromToolResults(
            toolResults,
            userMessage,
          );

          if (fallbackResponse && fallbackResponse.length > 10) {
            console.log('[AI-SDK5] Using fallback response');

            // ✅ CRÍTICO: Construir histórico com tool calls + tool results
            const firstResponse = await result.response;
            const messagesWithToolResults = [
              ...trimmedMessages,
              ...(firstResponse?.messages || []), // Tool calls + results da primeira chamada
              { role: 'assistant', content: fallbackResponse },
            ];

            console.log(
              '[AI-SDK5-FALLBACK] Messages with tool results:',
              messagesWithToolResults.length,
            );
            console.log(
              '[AI-SDK5-FALLBACK] Roles:',
              messagesWithToolResults.map((m: any) => m.role).join(', '),
            );

            return {
              text: fallbackResponse,
              messages: messagesWithToolResults,
            };
          }
        }
      }

      console.error('[AI-SDK5] No fallback available, returning error message');
      const errorMsg =
        'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
      return {
        text: errorMsg,
        messages: [
          ...trimmedMessages,
          { role: 'assistant', content: errorMsg },
        ],
      };
    }

    // 7. ✅ Salvar histórico com response.messages (AI SDK gerenciou tudo!)
    const responseMessages = await result.response;
    console.log(
      '[AI-SDK5] result.response.messages length:',
      responseMessages?.messages?.length || 0,
    );

    const updatedMessages = [
      ...trimmedMessages,
      ...(responseMessages?.messages || [
        { role: 'assistant', content: responseText },
      ]),
    ];

    console.log(
      '[AI-SDK5] Total messages in updated history:',
      updatedMessages.length,
    );
    console.log(
      '[AI-SDK5] Message roles:',
      updatedMessages.map((m: any) => m.role).join(', '),
    );

    this.cacheService.set(conversationKey, updatedMessages, 3600000);

    // 8. Métricas finais
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const realInputTokens = result.usage?.inputTokens || estimatedInputTokens;
    const realOutputTokens =
      result.usage?.outputTokens || this.estimateTokens(responseText);
    const totalTokens =
      result.usage?.totalTokens || realInputTokens + realOutputTokens;
    const estimatedCost =
      (realInputTokens * 0.075 + realOutputTokens * 0.3) / 1000000;

    console.log('[AI-SDK5] Response time:', responseTime, 'ms');
    console.log('[AI-SDK5] Tools called:', toolCallsCount);
    console.log('[AI-SDK5] Steps used:', result.steps?.length || 1);
    console.log(
      '[AI-SDK5] Tokens - Input:',
      realInputTokens,
      'Output:',
      realOutputTokens,
      'Total:',
      totalTokens,
    );
    console.log('[AI-SDK5] Estimated cost: $', estimatedCost.toFixed(6));

    this.recordMetric(
      actor,
      userMessage,
      responseTime,
      realInputTokens,
      realOutputTokens,
      totalTokens,
      estimatedCost,
      [], // TODO: Extrair tool names dos steps
      result.steps?.length || 1,
      usedFallback,
    );

    // ✅ Retornar texto E mensagens completas (com tool results)
    return {
      text: responseText,
      messages: updatedMessages,
    };
  }

  // ✅ Método processToolCall simplificado concluído!
  // Reduzido de ~540 linhas para ~200 linhas usando AI SDK 5 maxSteps

  // Estimativa simples de tokens (aprox. 4 caracteres = 1 token)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // ⚠️ OLD CODE BELOW - Código antigo comentado para referência
  // TODO: Deletar completamente após testes confirmarem que maxSteps funciona
  /*
      let allToolCalls: ToolCallPart[] = toolCalls;
      let finalResponseText = '';
      let currentResult = result; // Manter referência ao result atual

      // Processar tool calls recursivamente até maxToolDepth
      while (allToolCalls.length > 0 && currentDepth < maxToolDepth) {
        currentDepth++;
        console.log(
          `[AI] Processing tool calls at depth ${currentDepth}/${maxToolDepth}`,
        );

        // Executar as tools
        const toolResults = await Promise.all(
          allToolCalls.map(async (toolCall) => {
            const result = await this.executeTool(toolCall);
            return {
              type: 'tool-result' as const,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result,
            };
          }),
        );

        // ✅ Usar response.messages do AI SDK em vez de construir manualmente
        // Isso garante que o formato está correto para o Gemini
        if (currentResult.response?.messages) {
          currentMessages.push(...currentResult.response.messages);
        } else {
          // Fallback para compatibilidade (não deveria acontecer com AI SDK moderno)
          currentMessages.push({ role: 'assistant', content: allToolCalls });
          currentMessages.push({ role: 'tool', content: toolResults });
        }

        // Tentar fallback inteligente primeiro
        finalResponseText = this.buildFallbackResponseFromToolResults(
          toolResults,
          userMessage,
        );

        // Se fallback funcionar OU chegamos no limite de profundidade, parar
        if (finalResponseText && finalResponseText.length >= 10) {
          console.log('[AI] Using intelligent fallback, stopping tool calls');
          break;
        }

        if (currentDepth >= maxToolDepth) {
          console.log('[AI] Reached max tool depth');
          // Se o usuário pediu relatório, forçar generateReport diretamente
          const wantsReport =
            /relat[óo]rio|pdf|csv|txt|exportar|download/i.test(
              userMessage || '',
            );
          if (wantsReport) {
            try {
              console.log('[AI] Forcing generateReport at max depth');
              const forcedFormat =
                this.detectRequestedFormatFromMessage(userMessage);
              const forcedResult = await this.executeTool({
                toolName: 'generateReport',
                args: { cpf: actor.cpf, format: forcedFormat },
                toolCallId: 'forced-generateReport-at-maxDepth',
              });
              if (forcedResult?.downloadUrl) {
                finalResponseText = `Pronto! Aqui está seu relatório: ${forcedResult.downloadUrl}`;
              } else {
                finalResponseText =
                  forcedResult?.error ||
                  'Não consegui gerar o relatório agora. Por favor, tente novamente.';
              }
            } catch (e) {
              console.error(
                '[AI] Forced generateReport at max depth failed:',
                e,
              );
            }
          } else {
            console.log('[AI] Forcing final response without tools');
          }
          break;
        }

        // Fazer próxima chamada da IA (sempre com tools disponíveis)
        console.log(`[AI] Making AI call for depth ${currentDepth + 1}`);
        try {
          const nextResult = await this.callStreamTextWithFallback({
            system: this.promptService.getSystemPrompt(actor),
            messages: currentMessages,
            tools: availableTools, // ✅ Sempre passar tools
          });

          // Atualizar currentResult para usar response.messages na próxima iteração
          currentResult = nextResult;

          const nextToolCalls: ToolCallPart[] = [];
          finalResponseText = ''; // Reset para capturar nova resposta

          for await (const part of nextResult.fullStream) {
            if (part.type === 'text-delta') {
              finalResponseText += part.textDelta;
            } else if (part.type === 'tool-call') {
              nextToolCalls.push(part);
            } else if (part.type === 'error') {
              console.error(
                'Stream error at depth',
                currentDepth + 1,
                ':',
                part.error,
              );
            }
          }

          // Se a IA chamou mais tools, continuar no loop
          if (nextToolCalls.length > 0) {
            console.log(
              `[AI] AI made ${nextToolCalls.length} tool calls:`,
              nextToolCalls.map((tc) => tc.toolName),
            );
            allToolCalls = nextToolCalls;
            // Continue no while loop
          } else {
            // Se não chamou tools, temos a resposta final
            console.log('[AI] No more tool calls, got final response');
            // Se resposta estiver vazia, usar fallback baseado nas tools executadas
            if (!finalResponseText || finalResponseText.trim().length === 0) {
              console.warn('[AI] Empty response from model, using fallback');
              finalResponseText = this.buildFallbackResponseFromToolResults(
                toolResults,
                userMessage,
              );
            }
            break;
          }
        } catch (nextCallError: any) {
          console.error(
            `[AI] Call at depth ${currentDepth + 1} failed:`,
            nextCallError?.name,
          );

          // Detectar erro de overload
          const errorMessage = JSON.stringify(nextCallError);
          const isOverloadError =
            errorMessage.includes('overloaded') ||
            errorMessage.includes('503') ||
            errorMessage.includes('UNAVAILABLE') ||
            nextCallError?.statusCode === 503 ||
            nextCallError?.data?.error?.code === 503;

          if (isOverloadError) {
            console.log('[AI] Overload detected, using fallback model');
            usedFallback = true;

            try {
              const fallbackResult = await streamText({
                model: this.fallbackModel,
                system: this.promptService.getSystemPrompt(actor),
                messages: currentMessages,
                tools: availableTools,
                maxRetries: 2,
              });

              // Atualizar currentResult para usar response.messages na próxima iteração
              currentResult = fallbackResult;

              const fallbackToolCalls: ToolCallPart[] = [];
              finalResponseText = '';

              for await (const part of fallbackResult.fullStream) {
                if (part.type === 'text-delta') {
                  finalResponseText += part.textDelta;
                } else if (part.type === 'tool-call') {
                  fallbackToolCalls.push(part);
                } else if (part.type === 'error') {
                  console.error('Fallback stream error:', part.error);
                }
              }

              // Se fallback chamou tools, continuar processando
              if (fallbackToolCalls.length > 0) {
                allToolCalls = fallbackToolCalls;
              } else {
                // Tem resposta final
                break;
              }
            } catch (fallbackError) {
              console.error(
                '[AI] Fallback also failed, using intelligent fallback response',
              );
              // Manter fallback como resposta se tudo falhar
              break;
            }
          } else {
            // Se não for erro de overload, parar
            console.error('[AI] Non-overload error, stopping tool call loop');
            break;
          }
        }
      }

      // 🚨 VERIFICAÇÃO DE SEGURANÇA: Bloquear respostas com código e forçar generateReport
      if (
        finalResponseText &&
        (finalResponseText.includes('tool_codeprint') ||
          finalResponseText.match(/generateReport\s*\(/i) ||
          finalResponseText.match(/default_api\./i))
      ) {
        console.error(
          '[AI] ⛔️ DETECTED CODE IN RESPONSE! Forcing direct generateReport execution',
        );
        try {
          const forcedFormat =
            this.detectRequestedFormatFromMessage(userMessage);
          const forcedResult = await this.executeTool({
            toolName: 'generateReport',
            args: { cpf: actor.cpf, format: forcedFormat },
            toolCallId: 'forced-generateReport',
          });
          if (forcedResult?.downloadUrl) {
            finalResponseText = `Pronto! Aqui está seu relatório: ${forcedResult.downloadUrl}`;
          } else {
            finalResponseText =
              forcedResult?.error ||
              'Não consegui gerar o relatório agora. Por favor, tente novamente.';
          }
        } catch (e) {
          console.error('[AI] Forced generateReport failed:', e);
          finalResponseText =
            'Não consegui gerar o relatório agora. Por favor, tente novamente.';
        }
      }

      // Se não temos resposta final após o loop, fazer última tentativa
      if (!finalResponseText || finalResponseText.length < 10) {
        console.log('[AI] Making final call to get response');
        try {
          const finalResult = await this.callStreamTextWithFallback({
            system: this.promptService.getSystemPrompt(actor),
            messages: currentMessages,
            // Sem tools na última chamada para garantir resposta
          });
          finalResponseText = '';
          for await (const part of finalResult.fullStream) {
            if (part.type === 'text-delta') {
              finalResponseText += part.textDelta;
            }
          }
          // Após obter a resposta final, verificar e forçar generateReport se necessário
          const hasCode =
            !!finalResponseText &&
            (finalResponseText.includes('tool_codeprint') ||
              /generateReport\s*\(/i.test(finalResponseText) ||
              /default_api\./i.test(finalResponseText));
          const wantsReport =
            /relat[óo]rio|pdf|csv|txt|exportar|download/i.test(
              userMessage || '',
            );
          if (hasCode || wantsReport) {
            try {
              console.log('[AI] Forcing generateReport after final call');
              const forcedFormat =
                this.detectRequestedFormatFromMessage(userMessage);
              const forcedResult = await this.executeTool({
                toolName: 'generateReport',
                args: { cpf: actor.cpf, format: forcedFormat },
                toolCallId: 'forced-generateReport-after-final',
              });
              if (forcedResult?.downloadUrl) {
                finalResponseText = `Pronto! Aqui está seu relatório: ${forcedResult.downloadUrl}`;
              } else if (forcedResult?.error) {
                finalResponseText = forcedResult.error;
              }
            } catch (e) {
              console.error(
                '[AI] Forced generateReport after final failed:',
                e,
              );
            }
          }
        } catch (error) {
          console.error('[AI] Final call failed, using fallback text');
          finalResponseText = 'Dados obtidos com sucesso! Como posso ajudá-lo?';
        }
      }

      // Salvar conversa completa no cache (com ferramentas)
      const updatedMessages = [
        ...currentMessages,
        { role: 'assistant', content: finalResponseText },
      ];
      this.cacheService.set(conversationKey, updatedMessages, 3600000); // Cache por 1 hora (sessão)

      // Métricas finais (com tools)
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Use real token counts from AI SDK if available, otherwise estimate
      const realInputTokens = result.usage?.inputTokens || estimatedInputTokens;
      const realOutputTokens =
        result.usage?.outputTokens || this.estimateTokens(finalResponseText);
      const totalTokens =
        result.usage?.totalTokens || realInputTokens + realOutputTokens;

      // Cost calculation for Gemini 2.5 Flash-Lite (Primary) and Gemini 2.0 Flash-Lite (Fallback)
      // Both models: $0.075 per 1M input tokens, $0.30 per 1M output tokens
      const estimatedCost =
        (realInputTokens * 0.075 + realOutputTokens * 0.3) / 1000000;
      const toolCallsCount = toolCalls.length;

      console.log('[METRICS] Response time:', responseTime, 'ms');
      console.log('[METRICS] Tool calls made at depth 1:', toolCallsCount);
      console.log('[METRICS] Total depth reached:', currentDepth);
      console.log(
        '[METRICS] Real tokens used - Input:',
        realInputTokens,
        'Output:',
        realOutputTokens,
        'Total:',
        totalTokens,
      );
      console.log('[METRICS] Estimated cost: $', estimatedCost.toFixed(6));

      // Gravar métrica
      this.recordMetric(
        actor,
        userMessage,
        responseTime,
        realInputTokens,
        realOutputTokens,
        totalTokens,
        estimatedCost,
        toolCalls.map((tc) => tc.toolName),
        currentDepth, // Usar profundidade ao invés de cache hits
        usedFallback,
      );

      return finalResponseText;
    }

    // Se nenhuma ferramenta foi chamada, verificar se precisa forçar generateReport
    const textHasCode =
      !!textContent &&
      (textContent.includes('tool_codeprint') ||
        /generateReport\s*\(/i.test(textContent) ||
        /default_api\./i.test(textContent));
    const userWantsReport = /relat[óo]rio|pdf|csv|txt|exportar|download/i.test(
      userMessage || '',
    );

    if (textHasCode || userWantsReport) {
      try {
        const forcedFormat = this.detectRequestedFormatFromMessage(userMessage);
        const forcedResult = await this.executeTool({
          toolName: 'generateReport',
          args: { cpf: actor.cpf, format: forcedFormat },
          toolCallId: 'forced-generateReport',
        });
        if (forcedResult?.downloadUrl) {
          textContent = `Pronto! Aqui está seu relatório: ${forcedResult.downloadUrl}`;
        } else if (forcedResult?.error) {
          textContent = forcedResult.error;
        }
      } catch (e) {
        console.error(
          '[AI] Forced generateReport in no-tool branch failed:',
          e,
        );
        // Mantém textContent original como fallback
      }
    }

    // Se nenhuma ferramenta foi chamada, salvamos a conversa simples
    const updatedMessages = [
      ...trimmedMessages,
      { role: 'assistant', content: textContent },
    ];
    this.cacheService.set(conversationKey, updatedMessages, 3600000); // Cache por 1 hora (sessão)

    // Métricas finais (sem tools)
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Use real token counts from AI SDK if available, otherwise estimate
    const realInputTokens = result.usage?.inputTokens || estimatedInputTokens;
    const realOutputTokens =
      result.usage?.outputTokens || this.estimateTokens(textContent);
    const totalTokens =
      result.usage?.totalTokens || realInputTokens + realOutputTokens;

    // Cost calculation for Gemini 2.0 Flash-Lite (Primary) and Gemini 2.0 Flash (Fallback)
    // Both models: $0.075 per 1M input tokens, $0.30 per 1M output tokens
    const estimatedCost =
      (realInputTokens * 0.075 + realOutputTokens * 0.3) / 1000000;

    console.log('[METRICS] Response time:', responseTime, 'ms');
    console.log(
      '[METRICS] Real tokens used - Input:',
      realInputTokens,
      'Output:',
      realOutputTokens,
      'Total:',
      totalTokens,
    );
    console.log('[METRICS] Estimated cost: $', estimatedCost.toFixed(6));

    // Gravar métrica (sem tools)
    this.recordMetric(
      actor,
      userMessage,
      responseTime,
      realInputTokens,
      realOutputTokens,
      totalTokens,
      estimatedCost,
      [],
      0,
      usedFallback,
    );

    return textContent;
  }
  */
  // END OF OLD CODE - Fim do código antigo comentado

  // Gravar métrica da interação
  private recordMetric(
    actor: User,
    message: string,
    responseTime: number,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    cost: number,
    toolsUsed: string[],
    cacheHits: number,
    fallbackUsed: boolean,
  ): void {
    const metric: ChatMetric = {
      timestamp: Date.now(),
      userId: actor.cpf,
      userType: actor.role,
      message: message.substring(0, 100), // Limitar tamanho para logs
      responseTime,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      totalTokens,
      estimatedCost: cost,
      toolsUsed,
      cacheHits,
      fallbackUsed,
    };

    this.metricsService.recordChatMetric(metric);
  }

  // Build a concise human-friendly response from tool results when the model doesn't emit text
  // Agora o fallback é mais simples - deixa a IA fazer o trabalho de formatação na segunda chamada
  private buildFallbackResponseFromToolResults(
    toolResults: Array<{ toolName: string; result: any }>,
    userMessage: string,
  ): string {
    try {
      console.log(
        '[FALLBACK] Building response for',
        toolResults.length,
        'tool results',
      );
      console.log(
        '[FALLBACK] Tool results:',
        JSON.stringify(toolResults).substring(0, 300),
      );

      // Para casos simples onde conseguimos responder diretamente
      if (toolResults.length === 1) {
        const tr = toolResults[0];
        console.log('[FALLBACK] Single tool result:', tr.toolName);

        // Relatório gerado
        if (tr.toolName === 'generateReport') {
          if (tr.result && tr.result.downloadUrl) {
            return `✅ Relatório gerado! Link: ${tr.result.downloadUrl}`;
          } else if (tr.result && tr.result.error) {
            return `❌ Erro ao gerar relatório: ${tr.result.error}`;
          }
        }

        // Dados do estudante
        if (tr.toolName === 'getStudentInfo' && tr.result) {
          const data = tr.result;
          let response = `Seus dados:\n`;
          response += `• Nome: ${data.studentName}\n`;
          response += `• Email: ${data.studentEmail}\n`;
          if (data.studentPhone)
            response += `• Telefone: ${data.studentPhone}\n`;
          if (data.groupNames?.[0])
            response += `• Grupo: ${data.groupNames[0]}\n`;
          if (data.organizationsAndCourses?.[0]) {
            const org = data.organizationsAndCourses[0];
            response += `• Curso: ${org.courseNames?.[0] || 'Não especificado'} na ${org.organizationName}`;
          }
          return response;
        }

        // Pessoa encontrada (match exato)
        if (
          tr.toolName === 'findPersonByName' &&
          tr.result &&
          !tr.result.error
        ) {
          const person = tr.result;
          return `📋 ${person.name}\n\n• Email: ${person.email || 'Não disponível'}${person.phone ? `\n• Telefone: ${person.phone}` : ''}`;
        }

        // Pessoa não encontrada ou sugestão de similar
        if (
          tr.toolName === 'findPersonByName' &&
          tr.result &&
          tr.result.error
        ) {
          if (tr.result.suggestion) {
            // Se tem sugestão, mostrar dados da pessoa similar (SEM CPF)
            const person = tr.result.suggestion;
            return `${tr.result.error}\n\n📋 Dados de ${person.name}:\n• Email: ${person.email || 'Não disponível'}${person.phone ? `\n• Telefone: ${person.phone}` : ''}`;
          }
          return tr.result.error;
        }

        // Profissionais do estudante
        if (
          tr.toolName === 'getStudentsProfessionals' &&
          Array.isArray(tr.result)
        ) {
          if (tr.result.length === 0) {
            return 'Você não possui preceptores cadastrados no momento.';
          }

          // Verificar se o usuário quer a lista completa (sem buscar nome específico)
          const messageLower = userMessage
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const wantsFullList =
            /\b(quais|todos|lista|meus|quem sao|mostre)\b/.test(messageLower) &&
            !/\b(chamado|nome|tem|tenho)\b/.test(messageLower);

          // Se quer lista completa, retornar todos sem buscar nome
          if (wantsFullList) {
            let response = `Seus preceptores (${tr.result.length}):\n\n`;
            tr.result.forEach((prof: any, idx: number) => {
              response += `${idx + 1}. ${prof.name}\n`;
              response += `   • Email: ${prof.email || 'Não disponível'}\n`;
              if (prof.phone) response += `   • Telefone: ${prof.phone}\n`;
              if (prof.groupNames?.length > 0) {
                response += `   • Grupos: ${prof.groupNames.join(', ')}\n`;
              }
              response += '\n';
            });
            return response.trim();
          }

          // Verificar se a pergunta menciona um nome específico
          const searchWords = messageLower
            .split(/\s+/)
            .filter((w) => w.length >= 3);

          // Função para calcular distância de edição
          const editDistance = (a: string, b: string): number => {
            const matrix: number[][] = [];
            for (let i = 0; i <= b.length; i++) {
              matrix[i] = [i];
            }
            for (let j = 0; j <= a.length; j++) {
              matrix[0][j] = j;
            }
            for (let i = 1; i <= b.length; i++) {
              for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                  matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1,
                  );
                }
              }
            }
            return matrix[b.length][a.length];
          };

          let exactMatch: any = null;
          let similarMatch: any = null;

          // Buscar match exato primeiro
          exactMatch = tr.result.find((prof: any) => {
            const profNameLower = prof.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            const profWords = profNameLower.split(/\s+/);
            return searchWords.every((searchWord) =>
              profWords.some((profWord) => profWord === searchWord),
            );
          });

          // Se não encontrou exato, buscar similar
          if (!exactMatch) {
            similarMatch = tr.result.find((prof: any) => {
              const profNameLower = prof.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
              const profWords = profNameLower.split(/\s+/);

              return searchWords.some((searchWord) => {
                return profWords.some((profWord) => {
                  if (searchWord.length >= 4 && profWord.length >= 4) {
                    const distance = editDistance(searchWord, profWord);
                    const maxErrors = searchWord.length <= 6 ? 1 : 2;
                    const minSimilarity = 0.75;
                    const similarity =
                      1 -
                      distance / Math.max(searchWord.length, profWord.length);
                    return distance <= maxErrors && similarity >= minSimilarity;
                  }
                  return false;
                });
              });
            });
          }

          // Se encontrou match exato
          if (exactMatch) {
            let response = `Sim! ${exactMatch.name} é um dos seus preceptores.\n\n`;
            response += `📋 Dados:\n`;
            response += `• Email: ${exactMatch.email || 'Não disponível'}\n`;
            if (exactMatch.phone)
              response += `• Telefone: ${exactMatch.phone}\n`;
            if (exactMatch.groupNames?.length > 0) {
              response += `• Grupos: ${exactMatch.groupNames.join(', ')}`;
            }
            return response.trim();
          }

          // Se encontrou similar
          if (similarMatch) {
            let response = `Não encontrei ninguém com esse nome exato, mas você tem ${similarMatch.name} que é parecido. É essa pessoa?\n\n`;
            response += `📋 Dados:\n`;
            response += `• Email: ${similarMatch.email || 'Não disponível'}\n`;
            if (similarMatch.phone)
              response += `• Telefone: ${similarMatch.phone}\n`;
            if (similarMatch.groupNames?.length > 0) {
              response += `• Grupos: ${similarMatch.groupNames.join(', ')}`;
            }
            return response.trim();
          }

          // Se não encontrou nenhum match com nome, listar todos
          let response = `Seus preceptores (${tr.result.length}):\n\n`;
          tr.result.forEach((prof: any, idx: number) => {
            response += `${idx + 1}. ${prof.name}\n`;
            response += `   • Email: ${prof.email || 'Não disponível'}\n`;
            if (prof.phone) response += `   • Telefone: ${prof.phone}\n`;
            if (prof.groupNames?.length > 0) {
              response += `   • Grupos: ${prof.groupNames.join(', ')}\n`;
            }
            response += '\n';
          });
          return response.trim();
        }

        // Atividades agendadas do estudante
        if (
          tr.toolName === 'getStudentsScheduledActivities' &&
          Array.isArray(tr.result)
        ) {
          if (tr.result.length === 0) {
            return 'Você não possui atividades agendadas no momento.';
          }

          let response = `Suas atividades agendadas (${tr.result.length}):\n\n`;
          tr.result.forEach((activity: any, idx: number) => {
            response += `${idx + 1}. ${activity.activityName || 'Atividade'}\n`;
            if (activity.scheduledDate)
              response += `   • Data: ${activity.scheduledDate}\n`;
            if (activity.location)
              response += `   • Local: ${activity.location}\n`;
            if (activity.description)
              response += `   • Descrição: ${activity.description}\n`;
            response += '\n';
          });
          return response.trim();
        }

        // Profissionais do coordenador
        if (
          tr.toolName === 'getCoordinatorsProfessionals' &&
          Array.isArray(tr.result)
        ) {
          if (tr.result.length === 0) {
            return 'Você não possui profissionais supervisionados no momento.';
          }

          // Mesma lógica de lista completa
          const messageLower = userMessage
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const wantsFullList =
            /\b(quais|todos|lista|meus|quem sao|mostre)\b/.test(messageLower) &&
            !/\b(chamado|nome|tem|tenho)\b/.test(messageLower);

          if (wantsFullList || tr.result.length <= 10) {
            let response = `Seus profissionais supervisionados (${tr.result.length}):\n\n`;
            tr.result.forEach((prof: any, idx: number) => {
              response += `${idx + 1}. ${prof.name}\n`;
              response += `   • Email: ${prof.email || 'Não disponível'}\n`;
              if (prof.phone) response += `   • Telefone: ${prof.phone}\n`;
              response += '\n';
            });
            return response.trim();
          }

          return `Você tem ${tr.result.length} profissionais supervisionados. Use um filtro específico ou solicite um relatório para ver todos.`;
        }

        // Estudantes do coordenador
        if (
          tr.toolName === 'getCoordinatorsStudents' &&
          Array.isArray(tr.result)
        ) {
          if (tr.result.length === 0) {
            return 'Você não possui estudantes supervisionados no momento.';
          }

          // Mesma lógica de lista completa, mas com limite maior (100+ estudantes)
          const messageLower = userMessage
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const wantsFullList =
            /\b(quais|todos|lista|meus|quem sao|mostre)\b/.test(messageLower) &&
            !/\b(chamado|nome|tem|tenho)\b/.test(messageLower);

          // Se tem muitos estudantes (>20), não listar todos no chat
          if (tr.result.length > 20) {
            return `Você tem ${tr.result.length} estudantes supervisionados. Isso é muita informação para mostrar no chat. Gostaria de gerar um relatório em PDF/CSV?`;
          }

          if (wantsFullList) {
            let response = `Seus estudantes supervisionados (${tr.result.length}):\n\n`;
            tr.result.forEach((student: any, idx: number) => {
              response += `${idx + 1}. ${student.name}\n`;
              response += `   • Email: ${student.email || 'Não disponível'}\n`;
              if (student.phone)
                response += `   • Telefone: ${student.phone}\n`;
              response += '\n';
            });
            return response.trim();
          }

          return `Você tem ${tr.result.length} estudantes. Gostaria de ver todos ou buscar um específico?`;
        }

        // Atividades em andamento do coordenador
        if (
          tr.toolName === 'getCoordinatorsOngoingActivities' &&
          Array.isArray(tr.result)
        ) {
          if (tr.result.length === 0) {
            return 'Não há atividades em andamento no momento.';
          }

          let response = `Atividades em andamento (${tr.result.length}):\n\n`;
          tr.result.forEach((activity: any, idx: number) => {
            response += `${idx + 1}. ${activity.activityName || 'Atividade'}\n`;
            if (activity.startDate)
              response += `   • Início: ${activity.startDate}\n`;
            if (activity.location)
              response += `   • Local: ${activity.location}\n`;
            if (activity.participants)
              response += `   • Participantes: ${activity.participants}\n`;
            response += '\n';
          });
          return response.trim();
        }
      }

      // Para outros casos, retornar mensagem genérica útil
      return 'Encontrei os dados solicitados. Como posso ajudá-lo com essas informações?';
    } catch (err) {
      console.error('[AI] Error building fallback response:', err);
      return 'Dados obtidos com sucesso! Tente fazer uma pergunta específica ou solicitar um relatório.';
    }
  }

  private labelForTool(toolName: string, count: number): string {
    switch (toolName) {
      case 'getCoordinatorsOngoingActivities':
        return 'Atividades em andamento';
      case 'getCoordinatorsProfessionals':
        return 'Profissionais supervisionados';
      case 'getCoordinatorsStudents':
        return 'Estudantes supervisionados';
      case 'getCoordinatorDetails':
        return 'Detalhes do coordenador';
      case 'getStudentsScheduledActivities':
        return 'Suas atividades agendadas';
      case 'getStudentsProfessionals':
        return 'Seus preceptores';
      case 'findPersonByName':
        return 'Pessoa encontrada';
      default:
        return `Resultado (${toolName})`;
    }
  }

  private previewArray(items: any[], maxItems: number = 3): string {
    if (!items || items.length === 0) {
      return '';
    }
    const subset = items.slice(0, maxItems);
    const rendered = subset
      .map((item, idx) => `- ${this.previewObject(item)}`)
      .join('\n');
    const more =
      items.length > maxItems ? `\n... e mais ${items.length - maxItems}.` : '';
    return `${rendered}${more}`;
  }

  private previewObject(obj: any): string {
    if (!obj || typeof obj !== 'object') {
      return String(obj);
    }
    // Try well-known shapes first
    if (obj.studentName && obj.taskName) {
      const date = new Date(obj.scheduledStartTo).toLocaleDateString('pt-BR');
      const startTime = new Date(obj.startedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const endTime = new Date(obj.scheduledEndTo).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${obj.studentName} — ${obj.taskName} em ${obj.internshipLocationName} (${date}, ${startTime}-${endTime})`;
    }
    if (obj.taskName && obj.preceptorNames) {
      const date = new Date(obj.scheduledStartTo).toLocaleDateString('pt-BR');
      const startTime = new Date(obj.scheduledStartTo).toLocaleTimeString(
        'pt-BR',
        { hour: '2-digit', minute: '2-digit' },
      );
      const endTime = new Date(obj.scheduledEndTo).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${obj.taskName} — ${obj.internshipLocationName} (${date}, ${startTime}-${endTime}); Preceptores: ${obj.preceptorNames.join(', ')}`;
    }
    if (obj.name && obj.email && obj.cpf) {
      const groups = obj.groupNames
        ? `; Grupos: ${obj.groupNames.join(', ')}`
        : '';
      return `${obj.name} (CPF: ${obj.cpf}); Email: ${obj.email}${groups}`;
    }
    // Generic compact rendering (first 4 keys)
    const entries = Object.entries(obj)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v}`);
    return entries.join(' | ');
  }

  // Usar CacheService em vez de Map local para persistir entre requisições
  private getLastResultCacheKey(cpf: string): string {
    return `lastResult_${cpf}`;
  }

  // Cache acumulativo para combinar múltiplos dados
  private getAccumulatedDataCacheKey(cpf: string): string {
    return `accumulatedData_${cpf}`;
  }

  private getLastUserRequestCacheKey(cpf: string): string {
    return `lastUserRequest_${cpf}`;
  }

  private accumulateData(cpf: string, newData: any, toolName: string): void {
    const cacheKey = this.getAccumulatedDataCacheKey(cpf);
    const existing = this.cacheService.get(cacheKey) || {
      items: [],
      mostRecent: null,
    };

    // Adicionar novo dado com metadados
    const newItem = {
      toolName,
      timestamp: Date.now(),
      data: newData,
    };

    // 🚀 DEDUPLICAÇÃO: Verificar se já existe item idêntico ou muito similar
    const isDuplicate = existing.items.some((existingItem: any) => {
      // Mesmo toolName
      if (existingItem.toolName !== toolName) return false;

      // Comparar dados por JSON (detecção simples de duplicata exata)
      const existingDataStr = JSON.stringify(existingItem.data);
      const newDataStr = JSON.stringify(newData);

      if (existingDataStr === newDataStr) {
        console.log(
          `[CACHE] ⚠️ Duplicate data detected for ${toolName}, skipping accumulation`,
        );
        return true;
      }

      // Para findPersonByName: verificar se é a mesma pessoa (mesmo CPF ou email)
      if (toolName === 'findPersonByName') {
        const existingCpf =
          existingItem.data?.cpf || existingItem.data?.data?.cpf;
        const newCpf = newData?.cpf || newData?.data?.cpf;

        if (existingCpf && newCpf && existingCpf === newCpf) {
          console.log(
            `[CACHE] ⚠️ Same person already in accumulated data (CPF: ${newCpf}), skipping`,
          );
          return true;
        }
      }

      return false;
    });

    if (!isDuplicate) {
      existing.items.push(newItem);
      console.log(
        `[CACHE] Accumulated data for ${toolName}, total items: ${existing.items.length}`,
      );
    } else {
      console.log(
        `[CACHE] Data not accumulated (duplicate), total items remain: ${existing.items.length}`,
      );
    }

    // Marcar como mais recente (para referências "desse", "aquele")
    existing.mostRecent = newItem;

    // Não há limite de itens - cache expira automaticamente após 1h (TTL)
    // Conversas longas podem acumular quantos dados precisarem

    this.cacheService.set(cacheKey, existing, 3600000); // Expira em 1 hora
  }

  private getAccumulatedData(cpf: string): any[] {
    const cacheKey = this.getAccumulatedDataCacheKey(cpf);
    const accumulated = this.cacheService.get(cacheKey);
    return accumulated?.items || [];
  }

  private getMostRecentData(cpf: string): any | null {
    const cacheKey = this.getAccumulatedDataCacheKey(cpf);
    const accumulated = this.cacheService.get(cacheKey);
    return accumulated?.mostRecent?.data || null;
  }

  private clearAccumulatedData(cpf: string): void {
    const cacheKey = this.getAccumulatedDataCacheKey(cpf);
    this.cacheService.delete(cacheKey);
  }

  private combineAccumulatedData(accumulatedItems: any[]): any {
    // Combinar dados de múltiplas tools em um único array ou objeto
    const combined: any[] = [];

    for (const item of accumulatedItems) {
      if (Array.isArray(item.data)) {
        combined.push(...item.data);
      } else if (item.data && typeof item.data === 'object') {
        combined.push(item.data);
      }
    }

    return combined.length > 0 ? combined : accumulatedItems.map((i) => i.data);
  }

  private filterDataByFields(data: any, fieldsRequested: string): any {
    if (!data) return data;

    // Mapear campos solicitados para campos dos dados
    const fieldMapping: { [key: string]: string[] } = {
      nome: ['studentName', 'coordinatorName', 'name'],
      email: ['studentEmail', 'coordinatorEmail', 'email'],
      telefone: ['studentPhone', 'coordinatorPhone', 'phone'],
      grupo: ['groupNames'],
      grupos: ['groupNames'],
      curso: ['organizationsAndCourses'],
      cursos: ['organizationsAndCourses'],
      instituição: ['organizationsAndCourses'],
      instituicao: ['organizationsAndCourses'],
      organização: ['organizationsAndCourses'],
      organizacao: ['organizationsAndCourses'],
    };

    // Extrair campos solicitados da string
    const requestedLower = fieldsRequested.toLowerCase();
    const fieldsToInclude = new Set<string>();

    Object.entries(fieldMapping).forEach(([keyword, fields]) => {
      if (requestedLower.includes(keyword)) {
        fields.forEach((field) => fieldsToInclude.add(field));
      }
    });

    // Se não conseguir mapear campos, retornar dados originais
    if (fieldsToInclude.size === 0) {
      return data;
    }

    // Filtrar dados
    if (Array.isArray(data)) {
      return data.map((item) => this.filterSingleItem(item, fieldsToInclude));
    } else {
      return this.filterSingleItem(data, fieldsToInclude);
    }
  }

  private filterSingleItem(item: any, fieldsToInclude: Set<string>): any {
    const filteredItem: any = {};

    fieldsToInclude.forEach((field) => {
      if (item.hasOwnProperty(field)) {
        filteredItem[field] = item[field];
      }
    });

    return filteredItem;
  }

  private detectRequestedFormatFromMessage(
    message: string,
  ): 'pdf' | 'csv' | 'txt' {
    const normalized = (message || '').toLowerCase();
    if (normalized.includes('csv')) return 'csv';
    if (normalized.includes('txt') || normalized.includes('texto'))
      return 'txt';
    return 'pdf';
  }

  // Gerar chave específica do cache para cada tipo de tool
  private getToolCacheKey(toolName: string, cpf: string): string {
    return `tool_${toolName}_${cpf}`;
  }

  // This method maps the AI's tool choice to our actual service methods.
  private async executeTool(toolCall: any): Promise<any> {
    const { toolName, args } = toolCall;

    // Cache inteligente: verificar se já temos os dados deste tool
    const toolCacheKey = this.getToolCacheKey(toolName, args.cpf);
    const cachedResult = this.cacheService.get(toolCacheKey);

    if (cachedResult) {
      console.log(`[CACHE] Using cached result for ${toolName}`);
      // Atualizar lastResult para permitir geração de relatórios
      this.cacheService.set(
        this.getLastResultCacheKey(args.cpf),
        cachedResult,
        3600000,
      );
      return cachedResult;
    }

    let result: any; // To store the result of the data-fetching tools

    switch (toolName) {
      case 'getCoordinatorsOngoingActivities':
        result =
          await this.virtualAssistanceService.getCoordinatorsOngoingActivities(
            args.cpf,
          );
        this.cacheService.set(toolCacheKey, result, 3600000); // Cache específico do tool
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          result,
          3600000,
        ); // Cache do último resultado
        return result;
      case 'getCoordinatorsProfessionals':
        result =
          await this.virtualAssistanceService.getCoordinatorsProfessionals(
            args.cpf,
          );
        this.cacheService.set(toolCacheKey, result, 3600000);
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          result,
          3600000,
        );
        return result;
      case 'getCoordinatorsStudents':
        result = await this.virtualAssistanceService.getCoordinatorsStudents(
          args.cpf,
        );
        this.cacheService.set(toolCacheKey, result, 3600000);
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          result,
          3600000,
        );
        return result;
      case 'getStudentsScheduledActivities':
        result =
          await this.virtualAssistanceService.getStudentsScheduledActivities(
            args.cpf,
          );
        this.cacheService.set(toolCacheKey, result, 3600000);
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          result,
          3600000,
        );
        return result;
      case 'getStudentsProfessionals':
        result = await this.virtualAssistanceService.getStudentsProfessionals(
          args.cpf,
        );

        // Remover CPFs dos profissionais antes de retornar (privacidade)
        const professionalsWithoutCpf = result.map((professional) => ({
          name: professional.name,
          email: professional.email,
          phone: professional.phone,
          groupNames: professional.groupNames,
        }));

        this.cacheService.set(toolCacheKey, professionalsWithoutCpf, 3600000);
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          professionalsWithoutCpf,
          3600000,
        );
        return professionalsWithoutCpf;

      case 'getStudentInfo':
        result = await this.virtualAssistanceService.getStudentInfo(args.cpf);
        this.cacheService.set(toolCacheKey, result, 3600000);
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          result,
          3600000,
        );
        // Acumular para combinar com outros dados se necessário
        this.accumulateData(args.cpf, result, toolName);
        return result;
      case 'getCoordinatorInfo':
        result = await this.virtualAssistanceService.getCoordinatorInfo(
          args.cpf,
        );
        this.cacheService.set(toolCacheKey, result, 3600000);
        this.cacheService.set(
          this.getLastResultCacheKey(args.cpf),
          result,
          3600000,
        );
        return result;

      case 'findPersonByName':
        const { name: searchName, cpf: searcherCpf } = args;
        let foundPerson: any = null;

        // Função para normalizar texto (remover acentos e converter para lowercase)
        const normalizeText = (text: string): string => {
          return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
        };

        // Função para calcular distância de edição (Levenshtein distance)
        const editDistance = (a: string, b: string): number => {
          const matrix: number[][] = [];
          for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
          }
          for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
          }
          for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
              if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(
                  matrix[i - 1][j - 1] + 1,
                  matrix[i][j - 1] + 1,
                  matrix[i - 1][j] + 1,
                );
              }
            }
          }
          return matrix[b.length][a.length];
        };

        // Buscar em profissionais primeiro (mais comum)
        try {
          const professionalsRaw =
            await this.virtualAssistanceService.getStudentsProfessionals(
              searcherCpf,
            );

          // Filtrar CPFs (privacidade)
          const professionals = professionalsRaw.map((professional) => ({
            name: professional.name,
            email: professional.email,
            phone: professional.phone,
            groupNames: professional.groupNames,
          }));
          let exactMatch: any = null;
          let similarMatch: any = null;

          // Primeiro tentar busca exata (palavras completas)
          exactMatch = professionals.find((person) => {
            const normalizedPersonName = normalizeText(person.name);
            const normalizedSearchName = normalizeText(searchName);
            const personWords = normalizedPersonName.split(' ');
            const searchWords = normalizedSearchName.split(' ');

            // Match exato: todas as palavras da busca devem ter correspondência exata
            return searchWords.every((searchWord) =>
              personWords.some((personWord) => personWord === searchWord),
            );
          });

          // Se encontrou match exato, retornar
          if (exactMatch) {
            foundPerson = exactMatch;
          } else {
            // Se não encontrou, tentar busca por palavras individuais com tolerância a erros
            const searchWords = normalizeText(searchName)
              .split(' ')
              .filter((w) => w.length >= 3);

            similarMatch = professionals.find((person) => {
              const personWords = normalizeText(person.name).split(' ');

              return searchWords.some((searchWord) => {
                return personWords.some((personWord) => {
                  // Busca por similaridade mais rigorosa
                  if (searchWord.length >= 4 && personWord.length >= 4) {
                    const distance = editDistance(searchWord, personWord);
                    // Permitir apenas 1 erro para palavras até 6 caracteres
                    // e no máximo 2 erros para palavras maiores
                    const maxErrors = searchWord.length <= 6 ? 1 : 2;

                    // Adicionar verificação de similaridade mínima
                    const minSimilarity = 0.75; // 75% de similaridade
                    const similarity =
                      1 -
                      distance / Math.max(searchWord.length, personWord.length);

                    return distance <= maxErrors && similarity >= minSimilarity;
                  }

                  return false;
                });
              });
            });

            // Se encontrou similar, retornar mensagem informativa (sem CPF)
            if (similarMatch) {
              console.log(
                `[SEARCH] Similar match found: ${similarMatch.name} for search "${searchName}"`,
              );

              // Remover CPF antes de retornar (privacidade)
              const similarMatchWithoutCpf = {
                name: similarMatch.name,
                email: similarMatch.email,
                phone: similarMatch.phone,
                groupNames: similarMatch.groupNames,
              };

              this.cacheService.set(
                this.getLastResultCacheKey(searcherCpf),
                [similarMatchWithoutCpf],
                3600000,
              );
              return {
                error: `Não, mas você tem "${similarMatch.name}" que é parecido.`,
                suggestion: similarMatchWithoutCpf,
              };
            }
          }
        } catch (error) {
          console.log('Erro ao buscar em profissionais:', error);
        }

        if (foundPerson) {
          // Remover CPF antes de retornar (privacidade)
          const foundPersonWithoutCpf = {
            name: foundPerson.name,
            email: foundPerson.email,
            phone: foundPerson.phone,
            groupNames: foundPerson.groupNames,
          };

          this.cacheService.set(
            this.getLastResultCacheKey(searcherCpf),
            [foundPersonWithoutCpf],
            3600000,
          );
          // Acumular para combinar com outros dados se necessário
          this.accumulateData(
            searcherCpf,
            foundPersonWithoutCpf,
            'findPersonByName',
          );
          return foundPersonWithoutCpf;
        } else {
          return { error: `Pessoa com nome "${searchName}" não encontrada.` };
        }

      case 'generateReport':
        console.log('[REPORT-DEBUG] ========================================');
        console.log('[REPORT-DEBUG] generateReport tool execution started');
        console.log('[REPORT-DEBUG] CPF:', args.cpf);
        console.log('[REPORT-DEBUG] Format:', args.format);

        let lastData = this.cacheService.get(
          this.getLastResultCacheKey(args.cpf),
        );
        let accumulatedData = this.getAccumulatedData(args.cpf);
        const lastUserRequest = this.cacheService.get(
          this.getLastUserRequestCacheKey(args.cpf),
        ) as string | undefined;

        console.log(
          '[REPORT-DEBUG] Cache status: lastData=',
          !!lastData,
          'accumulatedData.length=',
          accumulatedData.length,
        );

        // 🚀 PRIORIDADE ALTA: Auto-fetch de dados se cache estiver vazio
        if (!lastData && accumulatedData.length === 0) {
          console.log(
            '[REPORT-DEBUG] Cache empty! Attempting auto-fetch of user data...',
          );

          try {
            // Tentar buscar dados do estudante primeiro
            try {
              console.log('[REPORT-DEBUG] Fetching student info...');
              const studentData =
                await this.virtualAssistanceService.getStudentInfo(args.cpf);

              console.log(
                '[REPORT-DEBUG] Student info fetched successfully:',
                !!studentData,
              );

              // Salvar no cache
              const studentToolCacheKey = this.getToolCacheKey(
                'getStudentInfo',
                args.cpf,
              );
              this.cacheService.set(studentToolCacheKey, studentData, 3600000);
              this.cacheService.set(
                this.getLastResultCacheKey(args.cpf),
                studentData,
                3600000,
              );
              this.accumulateData(args.cpf, studentData, 'getStudentInfo');

              lastData = studentData;
              accumulatedData = this.getAccumulatedData(args.cpf);

              console.log('[REPORT-DEBUG] Auto-fetch successful (student)');
            } catch (studentError) {
              // Se não é estudante, tentar coordenador
              console.log(
                '[REPORT-DEBUG] Not a student, trying coordinator...',
              );

              const coordinatorData =
                await this.virtualAssistanceService.getCoordinatorInfo(
                  args.cpf,
                );

              console.log(
                '[REPORT-DEBUG] Coordinator info fetched successfully:',
                !!coordinatorData,
              );

              // Salvar no cache
              const coordinatorToolCacheKey = this.getToolCacheKey(
                'getCoordinatorInfo',
                args.cpf,
              );
              this.cacheService.set(
                coordinatorToolCacheKey,
                coordinatorData,
                3600000,
              );
              this.cacheService.set(
                this.getLastResultCacheKey(args.cpf),
                coordinatorData,
                3600000,
              );

              lastData = coordinatorData;
              accumulatedData = this.getAccumulatedData(args.cpf);

              console.log('[REPORT-DEBUG] Auto-fetch successful (coordinator)');
            }
          } catch (autoFetchError) {
            console.error(
              '[REPORT-DEBUG] Auto-fetch failed:',
              autoFetchError.message,
            );

            return {
              error:
                'Não encontrei dados para gerar um relatório. Por favor, verifique se seu CPF está cadastrado no sistema.',
            };
          }
        }

        // Verificar novamente se temos dados
        if (!lastData && accumulatedData.length === 0) {
          console.error('[REPORT-DEBUG] Still no data after auto-fetch');

          return {
            error:
              'Não consegui obter os dados necessários. Por favor, faça uma busca primeiro ou verifique sua conexão.',
          };
        }

        console.log('[REPORT-DEBUG] Proceeding with report generation...');

        const { format: requestedFormat, fieldsRequested } = args;
        const format = requestedFormat || 'pdf'; // Default to PDF if not specified

        // Se tem múltiplos dados acumulados (ex: busca de estudante + preceptor), combinar
        let dataToUse = lastData;
        if (accumulatedData.length > 1) {
          console.log(
            `[REPORT] Combining ${accumulatedData.length} accumulated data sources`,
          );
          // Combinar dados de múltiplas tools
          dataToUse = this.combineAccumulatedData(accumulatedData);
          // Limpar cache acumulado após uso
          this.clearAccumulatedData(args.cpf);
        }

        // Filtrar dados se campos específicos foram solicitados
        let dataToReport = dataToUse;
        if (fieldsRequested) {
          dataToReport = this.filterDataByFields(dataToUse, fieldsRequested);
        }

        // Determinar título baseado no tipo de dados
        let title = fieldsRequested ? `Dados Solicitados` : 'Dados';
        if (Array.isArray(dataToReport) && dataToReport.length > 0) {
          if (dataToReport[0].studentName && dataToReport[0].taskName) {
            title = 'Atividades em Andamento';
          } else if (
            dataToReport[0].taskName &&
            dataToReport[0].preceptorNames
          ) {
            title = 'Atividades Agendadas';
          } else if (dataToReport[0].name && dataToReport[0].email) {
            title = 'Lista de Profissionais';
          }
        } else if (
          dataToReport &&
          typeof dataToReport === 'object' &&
          !Array.isArray(dataToReport)
        ) {
          if (dataToReport.studentName) {
            title = 'Dados do Estudante';
          } else if (dataToReport.coordinatorName) {
            title = 'Dados do Coordenador';
          }
        }

        const cacheId = randomUUID();
        this.cacheService.set(cacheId, { data: dataToReport, title });
        const downloadUrl = `${this.apiBaseUrl}/reports/from-cache/${cacheId}/${format}`;
        return { downloadUrl };

      default:
        return { error: 'Unknown tool' };
    }
  }

  /**
   * Trimming inteligente de mensagens: preserva tool-results importantes
   * Evita perder tool-results necessários para segunda chamada do Gemini
   */
  private smartTrimMessages(
    messages: CoreMessage[],
    maxTotal: number = 10,
  ): CoreMessage[] {
    if (messages.length <= maxTotal) {
      return messages;
    }

    console.log(
      '[SMART-TRIM] Original message count:',
      messages.length,
      'Target:',
      maxTotal,
    );

    // Garantir que preservamos:
    // 1. Última mensagem user (sempre)
    // 2. Pelo menos as últimas 2 mensagens tool
    // 3. Messages assistant que precedem tool calls

    const toolMessages: CoreMessage[] = [];
    const assistantWithToolCalls: CoreMessage[] = [];
    const regularMessages: CoreMessage[] = [];

    // Separar mensagens por tipo
    messages.forEach((msg) => {
      if (msg.role === 'tool') {
        toolMessages.push(msg);
      } else if (
        msg.role === 'assistant' &&
        Array.isArray(msg.content) &&
        msg.content.some((part: any) => part.type === 'tool-call')
      ) {
        assistantWithToolCalls.push(msg);
      } else {
        regularMessages.push(msg);
      }
    });

    console.log('[SMART-TRIM] Message types:', {
      tool: toolMessages.length,
      assistantWithToolCalls: assistantWithToolCalls.length,
      regular: regularMessages.length,
    });

    // Preservar últimas 2 tool messages
    const toolsToKeep = toolMessages.slice(-2);

    // Preservar assistant messages que geraram esses tool calls
    const assistantToKeep = assistantWithToolCalls.filter((assistantMsg) => {
      // Verificar se algum tool-result corresponde a este assistant
      return toolsToKeep.some((toolMsg: any) => {
        if (!Array.isArray(assistantMsg.content)) return false;

        const toolCalls = assistantMsg.content.filter(
          (part: any) => part.type === 'tool-call',
        );

        if (!Array.isArray(toolMsg.content)) return false;

        return toolMsg.content.some((toolResult: any) => {
          return toolCalls.some(
            (tc: any) => tc.toolCallId === toolResult.toolCallId,
          );
        });
      });
    });

    // Calcular quantas mensagens regulares podemos manter
    const reservedSlots = toolsToKeep.length + assistantToKeep.length + 1; // +1 para última user message
    const regularSlotsAvailable = Math.max(0, maxTotal - reservedSlots);

    // Pegar últimas mensagens regulares
    const regularToKeep = regularMessages.slice(-regularSlotsAvailable);

    // Reconstruir array mantendo ordem cronológica
    const result: CoreMessage[] = [];
    const toKeepSet = new Set([
      ...toolsToKeep,
      ...assistantToKeep,
      ...regularToKeep,
    ]);

    // Adicionar mensagens na ordem original
    messages.forEach((msg) => {
      if (toKeepSet.has(msg)) {
        result.push(msg);
      }
    });

    // Garantir que última mensagem é sempre preservada
    const lastMessage = messages[messages.length - 1];
    if (!result.includes(lastMessage)) {
      if (result.length >= maxTotal) {
        result.shift(); // Remover primeira para dar espaço
      }
      result.push(lastMessage);
    }

    console.log('[SMART-TRIM] Result message count:', result.length);
    console.log(
      '[SMART-TRIM] Preserved tools:',
      result.filter((m) => m.role === 'tool').length,
    );

    return result;
  }
}
