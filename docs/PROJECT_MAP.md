# Mapa do Projeto

> Gerado por `scripts/project-map.mjs`. Leia este resumo antes de explorar arquivos.

## Resumo

| Metrica | Total |
|---------|-------|
| Arquivos TS/TSX | 101 |
| Tabelas (Drizzle) | 30 |
| Server Actions (arquivos) | 6 |
| Rotas de API | 4 |
| Paginas | 4 |
| Componentes | 13 |

## Arvore (profundidade 3)

```
app/
  (app)/
  api/
    auth/
    settings/
    webhooks/
  crm/
    _components/
    error.tsx
    loading.tsx
    page.tsx
  entrar/
    _components/
    page.tsx
  perfil/
    _components/
    page.tsx
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
  operacao/
    page.tsx
  tags/
    page.tsx
  ui/
    alert-dialog.tsx
    button.tsx
  admin-access.tsx
  agent-settings.tsx
  modal-confirmacao-block.tsx
  settings.tsx
  workspace.tsx
lib/
  actions/
    agendamentos.ts
    crm.ts
    followups.ts
    operacao.ts
    sessoes.ts
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
    cookies.ts
    desafios.ts
    passkeys.ts
    permissoes.ts
    repositorio.ts
    sessao.ts
    validacao.ts
  chatbots/
    defaults.ts
    prompt.ts
    repository.ts
    schema.ts
  crm/
    acesso.ts
    cadastros.ts
    consultas.ts
    oportunidades.ts
    validacao.ts
  db/
    migrations/
    schema/
    bootstrap.ts
    client.ts
    index.ts
    migrate.ts
    porta.ts
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
  operacao/
    consultas.ts
    evento.ts
    receber.ts
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

### `atendeia_funis` — src/lib/db/schema/crm.ts
`id`, `modified_by`

### `atendeia_funis_etapas` — src/lib/db/schema/crm.ts
`id`, `nome`, `modified_by`

### `atendeia_funis_acessos` — src/lib/db/schema/crm.ts
`id`, `usuarioId`, `modified_by`

### `atendeia_motivos_perda` — src/lib/db/schema/crm.ts
`id`, `modified_by`

### `atendeia_funis_oportunidades` — src/lib/db/schema/crm.ts
`id`, `funilId`, `etapaId`, `contatoId`, `canalId`, `responsavelId`, `status`, `motivoId`, `observacao`, `modified_by`

### `atendeia_funis_oportunidades_tags` — src/lib/db/schema/crm.ts
`id`, `tagId`, `modified_by`

### `atendeia_funis_oportunidades_fechamentos` — src/lib/db/schema/crm.ts
`id`, `funilId`, `etapaAnteriorId`, `responsavelId`, `valor`, `modified_by`

### `atendeia_users_passkeys` — src/lib/db/schema/identidade.ts
`id`, `credencialId`, `nome`

### `atendeia_users_convites` — src/lib/db/schema/identidade.ts
`id`, `tokenHash`

### `atendeia_auth_desafios` — src/lib/db/schema/identidade.ts
`id`, `finalidade`, `conviteId`, `expiraEm`

### `atendeia_auth_limites` — src/lib/db/schema/identidade.ts
`id`, `tentativas`

### `usuarios` — src/lib/db/schema/usuarios.ts
`id`, `nome`, `email`, `papel`, `ativo`

### `atendeia_users` — src/lib/db/schema.ts
`id`, `passwordHash`, `enabled`

### `atendeia_webhook_recebimentos` — src/lib/db/schema.ts
`id`, `modified_by`

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
`id`, `details`, `entityId`

## Rotas de API

| Rota | Metodos |
|------|---------|
| `/api/auth/passkey` | POST |
| `/api/settings/agent` | GET |
| `/api/settings/integrations` | GET, PUT |
| `/api/webhooks/evolution` | POST |

## Server Actions

- `src/lib/actions/agendamentos.ts`: `carregarAgendamentos()`, `gravarAgendamento()`, `cancelarEnvioAgendado()`
- `src/lib/actions/crm.ts`: `carregarCrm()`, `adicionarFunil()`, `adicionarMotivo()`, `modificarMotivo()`, `salvarAcessosFunis()`, `adicionarOportunidade()`, `fecharNegocio()`, `moverNegocio()`
- `src/lib/actions/followups.ts`: `carregarFollowups()`, `salvarFollowups()`
- `src/lib/actions/operacao.ts`: `carregarOperacao()`
- `src/lib/actions/sessoes.ts`: `minhasSessoes()`, `encerrarMinhaSessao()`
- `src/lib/actions/tags.ts`: `carregarTags()`, `salvarTag()`, `excluirTag()`

## Paginas

- `src/app/crm/page.tsx`
- `src/app/entrar/page.tsx`
- `src/app/page.tsx`
- `src/app/perfil/page.tsx`
