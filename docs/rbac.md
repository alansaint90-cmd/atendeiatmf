# RBAC — controle de acesso

## Papeis

Hierarquicos: cada papel pode tudo o que os de baixo podem.

| Papel | Quem | Nivel |
|-------|------|-------|
| `super_admin` | Equipe de desenvolvimento: painel de problemas, auditoria completa | 0 |
| `admin` | Administrador do cliente: usuarios, relatorios, exclusoes | 1 |
| `operador` | Uso diario: lancamentos e operacoes | 2 |
| `visualizador` | Somente leitura | 3 |

A lista mora em `src/lib/db/schema/_enums.ts` (`PAPEIS`), do maior para o menor.
O `default` da coluna `usuarios.papel` e `visualizador` — o menor.

## Uma checagem so

```ts
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";

exigirPermissao(sessao, "operador");          // na action: lanca se nao alcanca
temPermissao(sessao, "admin");                // na pagina: decide o que mostrar
```

Nao existe outra assinatura. Permissao por recurso que nao for hierarquica vira ADR
antes de virar codigo.

## Matriz — papel MINIMO por acao

| Recurso | Ler | Criar | Alterar | Excluir |
|---------|-----|-------|---------|---------|
| Lancamentos | visualizador | operador | operador | admin |
| Contratos | visualizador | admin | admin | admin |
| Categorias | visualizador | admin | admin | admin |
| Relatorios | visualizador | admin | super_admin | super_admin |
| Usuarios | operador | admin | admin | admin |
| Configuracoes | admin | super_admin | admin | super_admin |
| Auditoria | admin | — (so o sistema grava) | nunca | nunca |
| Painel de problemas | super_admin | — | — | — |
| Tags (administração legada, ADR-0004) | super_admin | super_admin | super_admin | super_admin |
| Follow-ups (administração legada, ADR-0004) | super_admin | — | super_admin | — |
| Agendamentos individuais (ADR-0005) | super_admin | super_admin | super_admin | super_admin (cancelar) |

Recurso novo: acrescente a linha aqui ANTES de escrever a action.

## Regras

- O papel e o `ativo` sao lidos do banco a cada requisicao (`obterSessao`), nunca do token.
- Esconder botao e conforto; a action confere de novo.
- Usuario desativado perde acesso na proxima requisicao.
- Nenhum usuario ve dado de outra organizacao/tenant (quando o sistema for multi-tenant,
  o filtro de tenant entra em toda consulta, junto com `vivos()`).
- Recusa por permissao (403) vai para a trilha.
- Nunca zero donos: o ultimo `super_admin` nao pode ser rebaixado nem desativado.

## Painel do super_admin

- Alertas de lancamentos com erro ou inconsistencia
- Volume de erros por usuario e o detalhe (o que foi lancado × o que deveria ser)
- Registros excluidos: quem, quando, o que era
- Historico de alteracoes (tabela `auditoria`)
