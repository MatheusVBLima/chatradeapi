## Contexto
- Erro inicial: Gemini retornava `functionDeclaration parameters schema should be of type OBJECT` ao chamar tools (ex.: `findPersonByName`).  
- Após correções, o modelo ainda fazia perguntas desnecessárias e, em casos de relatório, não retornava o link (parava após tool-call).  
- Também surgiram respostas com fallback genérico e links de relatório vindos de cache expirado.  
- O modelo perguntava mesmo quando o pedido era explícito (ex.: “quais os meus dados?”), em vez de responder direto com os dados.  

## Principais correções aplicadas
- Ferramentas: troca para `inputSchema` + `jsonSchema()` e schemas explícitos `type: object` para todas as tools (AI SDK v5 + Gemini).  
- Prompts (`student.prompt.md` e `coordinator.prompt.md`): adicionada regra “não peça confirmação se o pedido já está claro”.  
- Fallback de tool-call em `gemini-ai.service.ts`:
  - Se o usuário pede relatório (relatório/pdf/exportar/download) e o modelo não responde após tool-call, forçamos `generateReport` e retornamos o link.  
  - Para `getCoordinatorsStudents`, o fallback agora lista diretamente até 20 estudantes (não pergunta mais “ver todos?”); se >20, avisa que é muita informação e sugere relatório.  
- Empty-response regen: se o modelo não gerar texto após tools, fazemos nova geração sem tools, injetando o resumo dos resultados para o modelo responder direto (sem formato hardcoded).  
- Retry 500/overload: se o modelo primário retorna 500/overload, caímos para o modelo fallback automaticamente.  

## Estado atual do código
- Schema dos tools está compatível com Gemini; `npm run build` passa.  
- Pedidos de relatório: mesmo se o modelo não gerar texto, o fallback força `generateReport` e responde com o link.  
- Listagem de estudantes no fallback: resposta direta, sem confirmar.  
- Se ainda não houver texto, há segunda tentativa de geração sem tools usando os dados das ferramentas.  
- Prompts reforçam: usar tools primeiro, responder com dados, não confirmar quando o pedido é claro, usar generateReport para pedidos de arquivo.  

## Pontos pendentes / riscos
- Gemini ainda retorna esporadicamente `500 Internal error` (retryable). Sugerido: retry automático com modelo de fallback ao detectar `statusCode === 500` ou `isRetryable`.  
- Links de relatório gerados “from-cache” podem expirar (404). Ideal: gerar link não-cache ou validar/salvar antes de responder.  
- Para listas muito grandes (>20 estudantes), ainda avisamos e pedimos relatório; se quiser, podemos já acionar generateReport automaticamente nesses casos.  
- Gemini ainda costuma encerrar o passo após a tool-call sem texto na primeira resposta; hoje dependemos da segunda geração sem tools para retornar o conteúdo. Ajustes como temperatura, prompt ou layout de mensagens podem reduzir essa ocorrência, mas ainda acontece.  

## Próximos passos sugeridos
- Implementar retry automático para erros 500 com modelo de fallback.  
- Ajustar geração de relatórios para evitar links expirados (ou revalidar antes de responder).  
- (Opcional) Ao detectar listas >20, chamar generateReport direto e devolver o link.  

