# ADR-0014: Pausa humana sem prazo e gatilho manual

Status: aceito. Substitui o prazo de intervenção manual da ADR-0003. A pausa
automática por transferência da ADR-0012 continua de 30 minutos enquanto não
houver intervenção humana; essa intervenção passa a exigir liberação explícita.

O usuário determinou pausa sem expiração após mensagem manual fromMe=true e
retomada somente pela frase completa “Se precisar de algo mais, é só falar.”
O webhook autentica a origem e aplica controle e enfileiramento no mesmo Lua.
Marcadores dos próprios envios da IA impedem que ecos pausem ou liberem. Texto do
cliente nunca libera. Pontuação, caixa e acentos são normalizados; frases maiores
contendo o trecho não são gatilho. Pares LID/telefone explícitos persistem, sem
inferir telefone; estado e aliases continuam isolados por instância e cliente.

O estado Redis passa a JSON sem TTL, contendo pausa, timestamp e ID do evento.
Valores numéricos antigos permanecem legíveis para pausas temporárias legadas e
transferência. Timestamp/ID recusam repetição e controles antigos. A retomada
conserva uma barreira temporal: o worker arquiva entradas anteriores ao gatilho
sem responder, mesmo que ainda estivessem na fila quando a pausa terminou.

O botão no seletor de Chatbot IA controla toda a instância escolhida.
As actions `consultarPausaIa` e `pausarIaInstancia` em `src/lib/actions/pausa-ia.ts`
consultam o estado e registram a pausa pelo componente `PausaIa`. Usam sessão
individual de gerente ou superior, Zod, guarda de instância configurada e versão
do canal. Mudança de versão e auditoria estão na mesma transação PostgreSQL; a
pausa Redis acontece antes da confirmação. Uma falha de commit após o Redis pode
deixar a instância conservadoramente pausada, sem confirmação falsa ao usuário.
Consulta de estado permite verificar a situação; não existe transação distribuída.

O botão exige confirmação de três segundos e não libera por outro botão. O mesmo
gatilho manual libera a instância. Pausa cancela ciclos da instância; os demais
números permanecem ativos. O worker revalida ambas as pausas antes de respostas e
follow-ups. Retomada não inicia ciclos antigos. Uma chamada externa já iniciada
não pode ser cancelada com garantia; entrega incerta continua sem repetição.

Não altera schema, não requer variável de ambiente nova e não apaga históricos.
Testes usam banco descartável, mocks e Redis local no banco 15.
