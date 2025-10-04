import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from '@ai-sdk/google';
import {
  streamText,
  type CoreTool,
  type LanguageModel,
  type CoreMessage,
  type ToolCallPart,
} from 'ai';
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
  private readonly primaryModel: LanguageModel;
  private readonly fallbackModel: LanguageModel;
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
    this.primaryModel = google('gemini-2.0-flash-lite');
    this.fallbackModel = google('gemini-2.5-flash-lite');
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
    tools?: Record<string, CoreTool>;
  }): Promise<any> {
    const { system, messages, tools } = params;

    // Try primary model first (sem retry interno - faremos nosso próprio fallback)
    try {
      console.log('[AI] Attempting with primary model (gemini-2.0-flash-lite)');
      return await streamText({
        model: this.primaryModel,
        system,
        messages,
        tools,
        maxRetries: 0, // Desabilitar retry automático do AI SDK
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
            model: this.fallbackModel,
            system,
            messages,
            tools,
            maxRetries: 2, // No fallback, permitir 2 retries
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

  async processToolCall(
    actor: User,
    userMessage: string,
    availableTools: Record<string, CoreTool>,
    maxToolDepth: number = 2, // Limite de chamadas de tools em sequência
  ): Promise<string> {
    const startTime = Date.now();
    console.log('[DEBUG] processToolCall called with:', actor.cpf, userMessage);

    // Buscar histórico de conversa do cache
    const conversationKey = `conversation_${actor.cpf}`;
    const existingMessages: CoreMessage[] =
      this.cacheService.get(conversationKey) || [];

    // Adicionar nova mensagem do usuário
    const messages: CoreMessage[] = [
      ...existingMessages,
      { role: 'user', content: userMessage },
    ];

    // Limitar histórico para evitar contexto muito grande (últimas 7 mensagens)
    // Aumentado para manter melhor contexto em conversas longas
    const trimmedMessages = messages.slice(-7);

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
      Object.keys(availableTools).length,
    );
    console.log('[METRICS] Message history length:', trimmedMessages.length);

    let result;
    let usedFallback = false;

    // Tentar com modelo primário primeiro
    try {
      result = await this.callStreamTextWithFallback({
        system: this.promptService.getSystemPrompt(actor),
        messages: trimmedMessages,
        tools: availableTools,
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
        console.log(
          '[AI] Overload detected, using fallback model (gemini-2.5-flash-lite)',
        );
        usedFallback = true;

        // Tentar com modelo fallback
        result = await streamText({
          model: this.fallbackModel,
          system: this.promptService.getSystemPrompt(actor),
          messages: trimmedMessages,
          tools: availableTools,
          maxRetries: 2,
        });
      } else {
        throw primaryError;
      }
    }

    // The AI SDK stream returns tool calls and text in separate parts.
    let textContent = '';
    const toolCalls: ToolCallPart[] = [];

    try {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          textContent += part.textDelta;
        } else if (part.type === 'tool-call') {
          toolCalls.push(part);
        } else if (part.type === 'error') {
          console.error(`Stream error:`, part.error);

          // Handle any unavailable tool error with standardized message
          if ((part.error as any)?.name === 'AI_NoSuchToolError') {
            return 'Desculpe, não posso te ajudar com essa questão. Posso ajudá-lo com informações sobre seus dados acadêmicos, atividades ou preceptores da plataforma RADE.';
          }

          throw new Error(`Stream error: ${JSON.stringify(part.error)}`);
        }
      }
    } catch (error) {
      console.error(`Error reading stream:`, error);
      throw error;
    }

    // If the model decides to call tools, we execute them and send the results back
    if (toolCalls.length > 0) {
      let currentDepth = 0;
      let currentMessages = trimmedMessages;
      let allToolCalls: ToolCallPart[] = toolCalls;
      let finalResponseText = '';

      // Processar tool calls recursivamente até maxToolDepth
      while (allToolCalls.length > 0 && currentDepth < maxToolDepth) {
        currentDepth++;
        console.log(
          `[AI] Processing tool calls at depth ${currentDepth}/${maxToolDepth}`,
        );

        currentMessages.push({ role: 'assistant', content: allToolCalls });

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

        currentMessages.push({ role: 'tool', content: toolResults });

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

      // Cost calculation for Gemini 2.0 Flash-Lite (Primary) and Gemini 2.0 Flash (Fallback)
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

  // Estimativa simples de tokens (aprox. 4 caracteres = 1 token)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

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
      // Para casos simples onde conseguimos responder diretamente
      if (toolResults.length === 1) {
        const tr = toolResults[0];

        // Relatório gerado
        if (tr.toolName === 'generateReport') {
          if (tr.result && tr.result.downloadUrl) {
            return `✅ Relatório gerado! Link: ${tr.result.downloadUrl}`;
          } else if (tr.result && tr.result.error) {
            return `❌ Erro ao gerar relatório: ${tr.result.error}`;
          }
        }

        // Pessoa não encontrada ou sugestão de similar
        if (
          tr.toolName === 'findPersonByName' &&
          tr.result &&
          tr.result.error
        ) {
          if (tr.result.suggestion) {
            // Se tem sugestão, mostrar dados da pessoa similar
            const person = tr.result.suggestion;
            return `${tr.result.error}\n\n📋 Dados de ${person.name}:\n• Email: ${person.email || 'Não disponível'}\n• CPF: ${person.cpf}\n• Telefone: ${person.phone || 'Não disponível'}`;
          }
          return tr.result.error;
        }
      }

      // Para outros casos, forçar segunda chamada da IA que agora tem instruções melhores
      return '';
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

    existing.items.push(newItem);

    // Marcar como mais recente (para referências "desse", "aquele")
    existing.mostRecent = newItem;

    // Não há limite de itens - cache expira automaticamente após 1h (TTL)
    // Conversas longas podem acumular quantos dados precisarem

    this.cacheService.set(cacheKey, existing, 3600000); // Expira em 1 hora

    console.log(
      `[CACHE] Accumulated data for ${toolName}, total items: ${existing.items.length}`,
    );
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
      grupos: ['groupNames'],
      instituição: ['organizationsAndCourses'],
      cursos: ['organizationsAndCourses'],
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
        const lastData = this.cacheService.get(
          this.getLastResultCacheKey(args.cpf),
        );
        const accumulatedData = this.getAccumulatedData(args.cpf);

        if (!lastData && accumulatedData.length === 0) {
          return {
            error:
              'Não encontrei dados para gerar um relatório. Por favor, faça uma busca primeiro.',
          };
        }

        const { format, fieldsRequested } = args;

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
            if (dataToReport[0].groupNames) {
              title = 'Lista de Profissionais';
            } else {
              title = 'Lista de Estudantes';
            }
          }
        } else if (
          dataToReport &&
          typeof dataToReport === 'object' &&
          !Array.isArray(dataToReport)
        ) {
          // Dados de estudante individual
          if (dataToReport.studentName || dataToReport.name) {
            title = fieldsRequested
              ? `Dados do Estudante - ${fieldsRequested}`
              : 'Dados do Estudante';
          } else if (dataToReport.coordinatorName) {
            title = fieldsRequested
              ? `Dados do Coordenador - ${fieldsRequested}`
              : 'Dados do Coordenador';
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
}
