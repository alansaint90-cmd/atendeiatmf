# AtendeIA TMF

Protótipo de atendimento com Next.js App Router, React, TypeScript estrito e validação Zod.

## Executar localmente

Requer Node.js 20.9 ou superior e pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra http://127.0.0.1:8000 e clique em **Entrar no MVP**. O acesso é demonstrativo, sem autenticação real.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

## Deploy no EasyPanel

Use o build por **Dockerfile**, caminho `Dockerfile` na raiz, e configure o domínio para a porta interna **3000**. O container executa `node server.js` com `HOSTNAME=0.0.0.0`; não é necessário sobrescrever o comando de inicialização.

Para testar onde houver Docker instalado:

```sh
docker build -t atendeiatmf .
docker run --rm -p 3000:3000 atendeiatmf
```

## Estrutura

- `src/app/`: entrada, layout e tratamento de erros do Next.js.
- `src/components/`: telas React, formulário de chatbot, configurações e caixa de entrada.
- `src/lib/chatbots/`: modelo validado, prompt inicial e repositório local centralizado.
- `src/lib/demo/`: dados e visualizações estáticas de demonstração.
- `src/styles/`: estilos separados por responsabilidade.
- `tests/`: testes de validação, preservação de dados e conflitos.
- `docs/regras-negocio.md`: limites e regras de persistência do protótipo.

## Dados e integrações

O campo **Contexto geral** contém o prompt TMF e permite editar e salvar no navegador. A migração mantém a chave `atendeia.chatbots.v1` e preserva contextos anteriormente editados na mesma origem (endereço e porta). Dados inválidos geram erro sem sobrescrever o conteúdo original.

A chave OpenAI fica somente na memória da página. Não existem chamadas OpenAI nem autenticação de usuários. O QR Code, os indicadores e as telas comerciais são demonstrativos. O webhook autenticado da Evolution recebe eventos no Redis, mas ainda não há processamento, respostas automáticas ou exibição desses eventos na caixa de entrada.

O próximo estágio de persistência relacional deve usar PostgreSQL 16 e Drizzle, com auditoria, exclusão lógica, controle de concorrência e RBAC conforme o AGENTS.md fornecido.

## Webhook Evolution

Após fazer deploy, configure na instância da Evolution:

- URL: `https://autoproiacfcsalmos-atendeiatmf.5ejbw3.easypanel.host/api/webhooks/evolution`
- Habilitado: sim. Webhook por eventos: não. Base64: não.
- Eventos: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`.
- Header personalizado: `x-webhook-secret`, com o mesmo valor de `EVOLUTION_WEBHOOK_SECRET` no AtendeIA.

No ambiente do AtendeIA, preencha `REDIS_URL`, `EVOLUTION_INSTANCE_NAME` e `EVOLUTION_WEBHOOK_SECRET`. O segredo deve ter pelo menos 32 caracteres aleatórios; não reutilize a chave da Evolution. Para gerar um segredo localmente:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

O GET da URL identifica a rota, sem expor configuração. As entregas exigem POST autenticado. Respostas: 202 (enfileirado), 200 (duplicado), 401 (segredo incorreto), 403 (outra instância), 413 (mais de 1 MiB), 422 (envelope/evento inválido), 503 (configuração ausente, Redis indisponível ou fila cheia). Não coloque o segredo na URL.

Use Redis dedicado com volume persistente, AOF e `noeviction`. A recepção é uma etapa inicial: a fila aceita até 1000 eventos sem remoção automática. Ainda é necessário implementar o consumidor para processamento contínuo. Testes automatizados usam uma fila substituta; valide a conexão com seu Redis após o deploy.
