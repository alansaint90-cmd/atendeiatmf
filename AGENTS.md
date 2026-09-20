# Atende AI TMF — instruções para agentes IA

> Codex, Cursor, Copilot, Gemini, Claude: leia este arquivo INTEIRO antes de qualquer
> tarefa. Ele é a fonte única das regras. `CLAUDE.md` só importa este arquivo.

## Contexto

Sistema de atendimento e configuração de chatbots para WhatsApp, integrado à Evolution. Credenciais e dados de atendimento devem ser preservados; a interface ainda contém módulos demonstrativos.

## Stack (fechada — não reabrir sem ADR)

- **Linguagem**: TypeScript strict
- **Framework**: Next.js (App Router, Server Components, Server Actions). Sem API separada.
  O `proxy.ts`/`middleware.ts` **não é fronteira de segurança**: página, action e handler
  conferem sessão por conta própria.
- **ORM**: Drizzle ORM — NUNCA Prisma
- **Banco**: PostgreSQL 16 via Docker, igual em dev, teste e produção — NUNCA SQLite
- **Validação**: Zod (`strictObject`) + regex nos formatos críticos
- **UI**: Tailwind + shadcn/ui
- **Testes**: Vitest + Testing Library
- **Princípios**: SOLID — alta coesão, baixo acoplamento, regra de negócio em um lugar só

Código, comentário, documentação, UI, mensagem de erro e commit em **PT-BR**.

## Ordem de leitura

1. Este arquivo, inteiro
2. `docs/PROJECT_MAP.md` — o que já existe (gerado por `npm run map`; não edite à mão)
3. `docs/regras-negocio.md` — regras do cliente
4. `docs/adr/` — decisões já tomadas e o porquê
5. O arquivo real que você vai alterar (sempre ler antes de editar)

## Regras absolutas

### Banco de dados
1. NUNCA SQLite, em nenhum ambiente. NUNCA Prisma.
2. NUNCA delete físico: `db.delete(`, `tx.delete(`, `.deleteMany(` e `DELETE FROM` reprovam
   no auditor e no pre-commit. Exclusão é `marcaDeExclusao()` (soft delete).
3. TODA tabela tem as 5 colunas de auditoria, sempre por `...colunasAuditoria`
   (`src/lib/db/schema/_compartilhado.ts`): `created_at`, `updated_at`, `deleted_at`,
   `is_deleted`, `modified_by`. Exceção só com marcador escrito e justificado:
   `compliance:append-only` (trilha de auditoria) ou `compliance:framework` (tabela que a
   lib de auth apaga sozinha).
4. NUNCA `timestamp()` cru: todo instante é `instante()` = `timestamptz(3)`. O
   microssegundo do Postgres nunca bate com o milissegundo do `Date` e a trava de colisão
   recusaria toda edição.
5. NUNCA `$onUpdate` em `updated_at` — quem grava `updated_at` é a action.
6. TODA FK com `{ onDelete: "restrict", onUpdate: "restrict" }` explícitos. Nunca cascade.
7. Dinheiro é `dinheiro()` (numeric em modo string). NUNCA `number` para valor monetário.
8. Enum é `text` + `CHECK` com a lista em `schema/_enums.ts`. NUNCA `pgEnum`.
9. Nome de tabela hierárquico e em snake_case: `contratos` → `contratos_lancamentos` →
   `contratos_lancamentos_categorias`.
10. TODA leitura filtra `vivos(tabela)`. TODA edição e exclusão usa
    `travaDeColisao(tabela, id, updatedAtOriginal)` (optimistic locking).
11. Mudança de schema só por migração: `npm run db:generate` + revisar o SQL +
    `npm run db:migrate`. NUNCA `drizzle-kit push`. NUNCA dropar tabela ou banco.

### Código
12. Regra de negócio mora em UM lugar (`src/lib/actions/<entidade>.ts` ou
    `src/lib/<dominio>/`). A tela chama a action; não duplica lógica.
13. TODA Server Action é um POST alcançável direto: começa com `exigirSessao()` +
    `exigirPermissao()` e valida TUDO com Zod, inclusive ids.
14. NUNCA espalhar o corpo da requisição na linha (`{ ...dados }`). Campo a campo.
    Papel, dono, preço e `modified_by` vêm do servidor.
15. Papel e `ativo` são lidos do BANCO a cada requisição — nunca do token.
16. Mutação + auditoria na MESMA transação (`registrarAuditoria(tx, ...)`).
17. Action que muta devolve `Resultado` via `executar()` — erro esperado vira mensagem.
    Em produção o Next esconde a mensagem de qualquer `throw`.
18. Ação crítica na tela (excluir, salvar lançamento financeiro) passa pelo
    `ModalConfirmacaoBlock`: 3 s travado, não fecha por ESC nem clique fora.
19. NUNCA `alert()`, NUNCA `any`, NUNCA erro cru do banco na tela.
20. NUNCA commitar segredo, `.env` ou senha literal — nem em seed, README ou docs.
    Variável nova vai documentada em `.env.example`.

### Estrutura
21. NUNCA criar arquivo na raiz. Use `src/`, `tests/`, `docs/`, `config/`, `scripts/`,
    `templates/`. (Configs que a ferramenta exige na raiz são a exceção.)
22. NUNCA arquivo com mais de 500 linhas — exceto `src/components/ui/` (shadcn vendorizado,
    não se edita).
23. NUNCA `node -e "..."` ou `psql -c "..."` inline no PowerShell com parêntese ou aspas: o
    shell cria na raiz arquivos com o nome do fragmento. Escreva um `.mjs` em `scripts/`.
    Limpeza: `npm run lixo` (simulação) e `node scripts/limpar-lixo-raiz.mjs --aplicar`.
24. NUNCA criar documentação sem pedido. MAS regra de negócio nova vai para
    `docs/regras-negocio.md` e decisão de arquitetura vira ADR em `docs/adr/`.
25. Quando mudar uma regra, mude no código, neste arquivo e no auditor juntos.

## Onde as coisas moram

| O quê | Onde |
| :--- | :--- |
| Conexão única com o banco | `src/lib/db/index.ts` (`db`, tipo `Transacao`) |
| Helpers de coluna | `src/lib/db/schema/_compartilhado.ts` (`instante`, `dinheiro`, `colunasAuditoria`) |
| Enums | `src/lib/db/schema/_enums.ts` (`PAPEIS`, `listaSql`) |
| Tabelas | `src/lib/db/schema/<tabela>.ts`, reexportadas em `schema/index.ts` |
| Soft delete e trava | `src/lib/db/soft-delete.ts` (`vivos`, `travaDeColisao`, `marcaDeExclusao`) |
| Trilha de auditoria | `src/lib/audit/registrar.ts` + tabela `auditoria` (append-only) |
| Sessão | `src/lib/auth/sessao.ts` (`obterSessao`, `exigirSessao`) — conectar a lib de auth |
| Permissão | `src/lib/auth/permissoes.ts` (`temPermissao`, `exigirPermissao`) — matriz em `docs/rbac.md` |
| Resultado de action | `src/lib/acao.ts` (`executar`, `ErroDeNegocio`, `Resultado`) |
| Validadores | `src/lib/validators/<entidade>.ts` |
| Actions | `src/lib/actions/<entidade>.ts` |
| Telas | `src/app/(app)/<rota>/page.tsx` + `_components/` |
| Modal de confirmação | `src/components/modal-confirmacao-block.tsx` |
| Arquivos-ouro | `templates/` (schema, validator, server-action, component, component.test) |
| Skills | `.agents/skills/` (`criar-tabela`, `criar-crud`, `criar-componente`, `repo-docs-sync`, `remove-ai-marks`) |

## Fluxo — funcionalidade nova

1. `npm run map` e leia `docs/PROJECT_MAP.md`: já existe algo parecido?
2. Construa de baixo para cima, copiando o arquivo-ouro de `templates/`:
   tabela (`criar-tabela`) → validador → action (`criar-crud`) → tela (`criar-componente`).
3. Escreva o teste junto — o caminho crítico (bloqueio, permissão, colisão) tem teste.
4. Regra nova em `docs/regras-negocio.md`; decisão nova em `docs/adr/`.
5. `npm run verificar` e `npm run build`. Reporte a saída REAL dos comandos.

## Fluxo — correção de bug

1. Reproduza e leia o estado antes de editar. Confira a trilha (`auditoria`): quem, o quê, quando.
2. Localize a camada: registro "sumiu" → a consulta usa `vivos()`? Edição sobrescreveu
   outra → o `updated_at` original chegou na action? Acesso indevido → `exigirPermissao`
   com o papel certo? Autoria errada → `modified_by` veio da sessão?
3. Corrija a CAUSA: procure todos os chamadores da função e corrija no ponto compartilhado.
4. Escreva o teste que falharia com o bug vivo; depois corrija.
5. `npm run verificar`. Reporte: sintoma × causa, arquivos alterados, saída dos comandos.

## Comandos

```bash
npm run db:up          # sobe o Postgres local (Docker)
npm run db:generate    # gera migração a partir do schema
npm run db:migrate     # aplica migrações
npm run dev            # app local
npm run verificar      # lint + tipos + auditor + trava + testes + drift de docs
npm run build          # build de produção
npm run compliance     # só o auditor
npm run map            # regenera docs/PROJECT_MAP.md
npm run lixo           # lista arquivos-lixo na raiz (simulação)
```

## Git

- `develop` recebe o trabalho (deploy HML); `master` só por merge validado (deploy PRD).
  NUNCA commitar direto na `master`.
- Conventional Commits em PT-BR (`docs/git-commits.md`), sem rodapé de coautoria.
- O pre-commit (`.githooks/pre-commit`) roda o auditor e bloqueia `.env`. Não use
  `--no-verify`. O CI roda tudo de novo.
- NUNCA deploy em PRD sem backup do banco (o pipeline já exige).

## Antes de dizer "pronto"

Rode `docs/definition-of-done.md`. No mínimo:

- [ ] `npm run verificar` verde e `npm run build` passando — com a saída colada no relatório
- [ ] Tabela nova com `...colunasAuditoria`, `instante()`, FK restrict, migração revisada
- [ ] Leitura com `vivos()`; edição e exclusão com `travaDeColisao()`
- [ ] Action com sessão, permissão, Zod, transação e auditoria
- [ ] Ação crítica com `ModalConfirmacaoBlock`
- [ ] Regra de negócio documentada; nenhum segredo exposto

Tarefa que toca login ou conta: siga também `docs/seguranca-login.md`.

## Adoção no Atende AI existente

Leia `docs/adr/0002-adocao-base-projeto-existente.md` antes de aplicar os modelos.
Esta instalação mantém pnpm, postgres-js e o histórico de migrações existente.
`src/lib/db/index.ts` é um adaptador da conexão única de `src/lib/db/client.ts`.
`src/lib/db/schema.ts` continua sendo o schema ativo; a pasta `schema/` contém
os modelos da base ainda não integrados. Não gere migrações destrutivas para trocar
um pelo outro. O login de demonstração não autentica usuários e a sessão nova
permanece fechada. O deploy existente usa EasyPanel/main; não promover esta branch
nem criar automação de SSH/PM2 sem a transição documentada.

`pnpm test` executa testes Node e Vitest. `pnpm verificar` mantém as barreiras da
base; divergências do legado ficam no relatório de instalação, sem isentar regras.

O schema ativo também usa fábricas locais de colunas (`timestamps()` e `audit()`).
O auditor analisa seus objetos de retorno e dependências sem executar código;
fábricas incompletas continuam reprovadas. Essa compatibilidade não altera o banco.

O agente de respostas segue ADR-0003. Código em `src/lib/agent/`; ativação explícita
por ATENDEIA_WORKER_ENABLED e AI_ENABLED. Não iniciar testes locais com credenciais
de produção. Testes de provedores usam mocks. Teste Redis usa apenas serviço local
descartável no banco 15. Nunca repetir automaticamente entrega incerta.

Follow-ups e tags seguem ADR-0004 e ADR-0008. Actions exigem sessão individual
e permissão de gerente ou superior. Não aceitar token administrativo como acesso.
Tags preservam auditoria e versão do schema ativo.
Follow-ups usam o lease Redis existente; alteração de configuração invalida ciclos
anteriores. Não ativar envios reais para testar as páginas.

Agendamentos individuais seguem ADR-0005 e a mesma guarda administrativa.
Reservar no PostgreSQL antes de chamar a Evolution; registro em envio nunca volta
automaticamente para pendente. A execução depende do worker, mas não de AI_ENABLED.

CRM e identidade seguem ADR-0006, em validação. Novos módulos usam sessão individual
sobre atendeia_users; não reutilizar token administrativo como identidade humana.
Não ativar AUTH_LOGIN_ENABLED em produção antes de fechar a régua de segurança de
login e conta. Migrações 0003/0004 são aditivas; testes usam banco descartável.

ADR-0008 substitui o acesso humano por token: senha Argon2id e passkey verificada,
com alternativa de passkey sem senha. ExigirPermissao é assíncrona e requer await;
tests/guardas-actions.test.ts fiscaliza a regra. admin representa Gerente e operador
representa SDR, preservando o schema. Super administrador só por provisionamento
manual; gerente administra apenas SDRs. Suspensão, troca de senha ou fator revogam
sessões. Nenhum teste de autenticação usa banco de produção.
