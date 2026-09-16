# Regras do protótipo

- Configurações de chatbot pertencem ao navegador e à origem onde foram salvas; não são compartilhadas com outros usuários.
- Identificadores de chatbot são obrigatórios e únicos, sem distinção entre maiúsculas e minúsculas.
- Cada chatbot permite até três personalidades distintas e até 50 fluxos com nome e descrição preenchidos.
- Atraso: inteiro entre 0 e 3600 segundos. Temperatura: entre 0 e 1. Contexto: até 200 mil caracteres.
- Toda leitura e gravação passa pela validação centralizada. Dados inválidos não são substituídos automaticamente.
- Uma gravação é recusada se outra aba alterou os dados desde a leitura. O usuário deve recarregar antes de tentar novamente. Essa checagem local não substitui transações no futuro backend.
- O acesso demonstrativo não representa autenticação. A administração de integrações exige um token próprio e não há atendimento real por IA/WhatsApp.

## Credenciais de integrações

- `DATABASE_URL`, `SETTINGS_ADMIN_TOKEN` (mínimo 32 caracteres aleatórios) e `SETTINGS_ENCRYPTION_KEY` (32 bytes em base64) habilitam a persistência. Esses valores são definidos no ambiente, nunca pelo formulário público.
- O token concede exclusivamente o papel `super_admin` da configuração global desta instalação. Não é uma solução multiempresa. A validação ocorre no servidor em toda leitura e gravação; o token fica apenas na memória da tela.
- Drizzle/PostgreSQL cria tabelas próprias com inicialização transacional serializada, sem modificar tabelas existentes. Tabelas possuem auditoria, soft delete e referências RESTRICT. O usuário de banco precisa de permissão para criá-las.
- Credenciais são criptografadas com AES-256-GCM e não são devolvidas ao navegador, registradas em logs nem na auditoria. Auditoria registra somente campos alterados, versão, data e administrador. Faça backup do banco e da chave de criptografia separadamente. Alterar a chave sem migrar os dados impede sua leitura.
- Campos vazios preservam valores existentes; valores salvos prevalecem sobre o ambiente. A versão impede sobrescritas concorrentes. A confirmação de gravação aguarda 3 segundos.
- O webhook lê a configuração persistida quando a chave de criptografia está definida. Falhas no banco ou na descriptografia retornam 503, sem recorrer silenciosamente a credenciais antigas. Instalações sem persistência continuam usando o ambiente.
- Salvar não testa conexão com provedores. As chaves OpenAI/Evolution ficam disponíveis no servidor para futura integração; não há consumidor da fila nem geração/envio de respostas implementados.

## Recepção de eventos Evolution

- `POST /api/webhooks/evolution` autentica o serviço pelo header `x-webhook-secret`, comparado com `EVOLUTION_WEBHOOK_SECRET` (mínimo de 32 caracteres).
- Aceita apenas a instância definida em `EVOLUTION_INSTANCE_NAME` e os eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e `CONNECTION_UPDATE`.
- Exige JSON, com no máximo 1 MiB; rejeita envelopes inválidos e remove campos extras do envelope, incluindo a chave de API da Evolution.
- Retorna 202 apenas após gravação no stream Redis `atendeia:{evolution}:events`. Cada registro contém data de recebimento e origem. Redis indisponível ou fila cheia resultam em 503, sem alegar recebimento.
- Eventos idênticos são deduplicados por 24 horas; transições de conexão/status sem timestamp não são deduplicadas para não perder ocorrências legítimas.
- O stream comporta até 1000 eventos e não descarta eventos antigos automaticamente. Ainda não existe consumidor da fila; após atingir a capacidade, novas entregas recebem 503. O próximo estágio deve processar e arquivar eventos antes de liberar capacidade.
- Usar Redis dedicado com volume persistente, AOF e política `noeviction` para evitar perda por reinício ou pressão de memória. A aplicação confirma a gravação no Redis, não a sincronização em disco.
- O endpoint não fornece mensagens a usuários sem autenticação. O GET público só identifica a rota; não testa credenciais nem a conexão Redis. O painel continua demonstrativo e não consome esses eventos.
