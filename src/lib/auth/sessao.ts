import { and, eq } from "drizzle-orm";
import { ErroDeNegocio } from "@/lib/acao";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema/usuarios";
import { vivos } from "@/lib/db/soft-delete";
import type { SessaoAtiva } from "./permissoes";

/**
 * Devolve o id do usuario logado segundo a biblioteca de auth.
 * CONECTE AQUI a lib escolhida. Enquanto nao conectar, ninguem entra
 * (fail-closed). Exemplo com Better Auth:
 *   const s = await auth.api.getSession({ headers: await headers() });
 *   return s?.user.id ?? null;
 */
async function idDoUsuarioLogado(): Promise<string | null> {
  return null;
}

/** Sessao com papel e `ativo` lidos do BANCO a cada requisicao — nunca do token. */
export async function obterSessao(): Promise<SessaoAtiva | null> {
  const id = await idDoUsuarioLogado();
  if (!id) return null;
  const [u] = await db
    .select({ papel: usuarios.papel, ativo: usuarios.ativo })
    .from(usuarios)
    .where(and(eq(usuarios.id, id), vivos(usuarios)));
  if (!u || !u.ativo) return null;
  return { userId: id, papel: u.papel };
}

/** Portao de toda Server Action: sem sessao valida, nada roda. */
export async function exigirSessao(): Promise<SessaoAtiva> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroDeNegocio("Sessao expirada. Entre novamente.");
  return sessao;
}
