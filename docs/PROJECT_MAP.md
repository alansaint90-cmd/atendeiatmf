# Mapa do Projeto

> Gerado por `scripts/project-map.mjs`. Leia este resumo antes de explorar arquivos.

## Resumo

| Metrica | Total |
|---------|-------|
| Arquivos TS/TSX | 70 |
| Tabelas (Drizzle) | 18 |
| Server Actions (arquivos) | 3 |
| Rotas de API | 3 |
| Paginas | 1 |
| Componentes | 13 |

## Arvore (profundidade 3)

```
app/
  (app)/
  api/
    settings/
    webhooks/
  error.tsx
  layout.tsx
  page.tsx
components/
  agendamentos/
    page.tsx
  chatbots/
    editor.tsx
    page.tsx
  followups/
    page.tsx
  tags/
    page.tsx
  ui/
    alert-dialog.tsx
    button.tsx
  admin-access.tsx
  agent-settings.tsx
  inbox.tsx
  modal-confirmacao-block.tsx
  settings.tsx
  workspace.tsx
lib/
  actions/
    agendamentos.ts
    followups.ts
    tags.ts
  agendamentos/
    repository.ts
    schema.ts
    worker.ts
  agent/
    config.ts
    message.ts
    processor.ts
    providers.ts
    redis.ts
    store.ts
    worker.ts
  audit/
    registrar.ts
  auth/
    permissoes.ts
    sessao.ts
  chatbots/
    defaults.ts
    prompt.ts
    repository.ts
    schema.ts
  db/
    migrations/
    schema/
    bootstrap.ts
    client.ts
    index.ts
    migrate.ts
    schema.ts
    soft-delete.ts
  demo/
    data.ts
    icons.ts
    views.ts
  evolution/
    queue.ts
    schema.ts
    webhook.ts
  followups/
    processor.ts
    queue.ts
    schedule.ts
    schema.ts
  settings/
    access.ts
    repository.ts
    schema.ts
    security.ts
  tags/
    repository.ts
    schema.ts
  validators/
  acao.ts
  use-hydrated.ts
  utils.ts
styles/
  automation.css
  base.css
  features.css
  improvements.css
  layout.css
  ui.css
instrumentation.ts
```

## Tabelas (Drizzle)

### `auditoria` — src/lib/db/schema/auditoria.ts
`id`, `user_id`, `acao`, `tabela`, `registro_id`, `detalhes`, `dados_anteriores`, `dados_novos`, `created_at`

### `usuarios` — src/lib/db/schema/usuarios.ts
`id`, `nome`, `email`, `papel`, `ativo`

### `atendeia_users` — src/lib/db/schema.ts
`id`, `passwordHash`, `enabled`

### `atendeia_agendamentos` — src/lib/db/schema.ts
`id`, `agendadoPara`, `iniciadoEm`, `codigoErro`, `modified_by`

### `atendeia_sessions` — src/lib/db/schema.ts
`id`, `tokenHash`

### `atendeia_departments` — src/lib/db/schema.ts
_(colunas nao detectadas)_

### `atendeia_department_members` — src/lib/db/schema.ts
`id`, `userId`

### `atendeia_contacts` — src/lib/db/schema.ts
`id`, `source`, `score`

### `atendeia_tags` — src/lib/db/schema.ts
_(colunas nao detectadas)_

### `atendeia_contact_tags` — src/lib/db/schema.ts
`id`, `tagId`

### `atendeia_chatbots` — src/lib/db/schema.ts
`id`, `configuration`

### `atendeia_flows` — src/lib/db/schema.ts
`id`, `name`, `definition`

### `atendeia_channels` — src/lib/db/schema.ts
`id`, `instanceName`, `status`

### `atendeia_conversations` — src/lib/db/schema.ts
`id`, `contactId`, `remoteJid`, `departmentId`, `assignedTo`, `chatbotId`, `humanTakeover`, `lastMessageAt`

### `atendeia_messages` — src/lib/db/schema.ts
`id`, `providerMessageId`, `senderType`, `messageType`, `sentAt`

### `atendeia_campaigns` — src/lib/db/schema.ts
`id`, `content`, `scheduledAt`

### `atendeia_campaign_recipients` — src/lib/db/schema.ts
`id`, `contactId`, `messageId`, `status`

### `atendeia_audit_logs` — src/lib/db/schema.ts
`id`, `entityId`

## Rotas de API

| Rota | Metodos |
|------|---------|
| `/api/settings/agent` | GET |
| `/api/settings/integrations` | GET, PUT |
| `/api/webhooks/evolution` | POST |

## Server Actions

- `src/lib/actions/agendamentos.ts`: `carregarAgendamentos()`, `gravarAgendamento()`, `cancelarEnvioAgendado()`
- `src/lib/actions/followups.ts`: `carregarFollowups()`, `salvarFollowups()`
- `src/lib/actions/tags.ts`: `carregarTags()`, `salvarTag()`, `excluirTag()`

## Paginas

- `src/app/page.tsx`
