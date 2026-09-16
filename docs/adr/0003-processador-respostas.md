# ADR-0003: Processamento de respostas WhatsApp

- Status: Aceito para implementação; ativação externa explícita.
- Data: 2026-09-16

O webhook anterior somente enfileirava eventos. Implementamos um consumidor Redis
no processo Node persistente já usado pelo EasyPanel. Ele não roda durante build,
nem inicia sem ATENDEIA_WORKER_ENABLED=true. AI_ENABLED permite pausar os envios.
Não funciona como worker persistente em hospedagem serverless.

Mantemos a configuração administrativa existente no PostgreSQL, com criptografia,
autenticação e versão. AI_SYSTEM_PROMPT é editável e salvo nesse mesmo repositório;
o navegador pode importar uma cópia do contexto de um chatbot local. Não criamos
um segundo cadastro ou migração de tabelas para esta etapa.

Entrega e histórico recente ficam no Redis dedicado. Consumer group com consumidor
fixo e lease global recuperam eventos pendentes; scripts Lua verificam posse antes
de mudar checkpoints, confirmar histórico ou arquivar/confirmar a fila. A execução
serial favorece consistência em instalação pequena; aumentar paralelismo exige
particionar por conversa e rever a recuperação, não apenas aumentar réplicas.

Falhas de geração têm até três tentativas. Não repetimos envios com resultado
incerto, pois a API externa não fornece uma garantia de idempotência comprovada.
Isso pode exigir intervenção manual após uma queda, mas evita respostas duplicadas.
Não declarar entrega exatamente uma vez. Redis deve ter persistência e noeviction.

Retenções: diário de entrega 30 dias, histórico de 12 turnos por 24 horas, arquivo
limitado a 10 mil resultados. As tabelas operacionais e a caixa de entrada não são
integradas por esta mudança. Grupos, mídia, lotes, fluxos e atendimento humano ficam
fora da automação de texto inicial. Eventos antigos não geram respostas atrasadas.

Fontes verificadas para os contratos externos:

- [OpenAI Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create): instructions, input e store.
- [Evolution SendTextDto](https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/dto/sendMessage.dto.ts): number, text e linkPreview. Testes usam provedores simulados; compatibilidade final depende da instalação Evolution ativa.

Validação: testes unitários de seleção de eventos, provedores, geração, pausa,
retentativas e quedas durante envio; testes de UI e proteção administrativa. O CI
inclui Redis 7 descartável no banco 15 para executar recuperação de pendentes,
diário, histórico, arquivo, deduplicação e rejeição de posse antiga com Lua real.

Verificação local executada: lint e TypeScript aprovados; auditor com 53 arquivos
e zero violações; 28/28 testes do auditor; 31 testes Node aprovados e um teste Redis
pulado por ausência de TEST_REDIS_URL; 6 testes de UI aprovados. Build compilou em
11 segundos e gerou as três páginas. Não houve chamada real aos provedores.
