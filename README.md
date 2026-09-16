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

A chave OpenAI fica somente na memória da página. Não existem chamadas OpenAI, conexão WhatsApp, backend de dados ou autenticação real. O QR Code, os indicadores e as telas comerciais são demonstrativos.

O próximo estágio de persistência no servidor deve usar PostgreSQL 16 e Drizzle, com auditoria, exclusão lógica, controle de concorrência e RBAC conforme o AGENTS.md fornecido. Nenhum banco ou endpoint sem autenticação foi adicionado nesta revisão.
