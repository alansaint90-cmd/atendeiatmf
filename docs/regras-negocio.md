# Regras do protótipo

- Configurações de chatbot pertencem ao navegador e à origem onde foram salvas; não são compartilhadas com outros usuários.
- Identificadores de chatbot são obrigatórios e únicos, sem distinção entre maiúsculas e minúsculas.
- Cada chatbot permite até três personalidades distintas e até 50 fluxos com nome e descrição preenchidos.
- Atraso: inteiro entre 0 e 3600 segundos. Temperatura: entre 0 e 1. Contexto: até 200 mil caracteres.
- Toda leitura e gravação passa pela validação centralizada. Dados inválidos não são substituídos automaticamente.
- Uma gravação é recusada se outra aba alterou os dados desde a leitura. O usuário deve recarregar antes de tentar novamente. Essa checagem local não substitui transações no futuro backend.
- A chave OpenAI permanece apenas na memória da página. Nunca é gravada no navegador nem enviada a serviços externos pelo protótipo.
- O acesso demonstrativo não representa autenticação ou RBAC. Não há banco de dados nem atendimento real por IA/WhatsApp.

## Recepção de eventos Evolution

- `POST /api/webhooks/evolution` autentica o serviço pelo header `x-webhook-secret`, comparado com `EVOLUTION_WEBHOOK_SECRET` (mínimo de 32 caracteres).
- Aceita apenas a instância definida em `EVOLUTION_INSTANCE_NAME` e os eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e `CONNECTION_UPDATE`.
- Exige JSON, com no máximo 1 MiB; rejeita envelopes inválidos e remove campos extras do envelope, incluindo a chave de API da Evolution.
- Retorna 202 apenas após gravação no stream Redis `atendeia:{evolution}:events`. Cada registro contém data de recebimento e origem. Redis indisponível ou fila cheia resultam em 503, sem alegar recebimento.
- Eventos idênticos são deduplicados por 24 horas; transições de conexão/status sem timestamp não são deduplicadas para não perder ocorrências legítimas.
- O stream comporta até 1000 eventos e não descarta eventos antigos automaticamente. Ainda não existe consumidor da fila; após atingir a capacidade, novas entregas recebem 503. O próximo estágio deve processar e arquivar eventos antes de liberar capacidade.
- Usar Redis dedicado com volume persistente, AOF e política `noeviction` para evitar perda por reinício ou pressão de memória. A aplicação confirma a gravação no Redis, não a sincronização em disco.
- O endpoint não fornece mensagens a usuários sem autenticação. O GET público só identifica a rota; não testa credenciais nem a conexão Redis. O painel continua demonstrativo e não consome esses eventos.
