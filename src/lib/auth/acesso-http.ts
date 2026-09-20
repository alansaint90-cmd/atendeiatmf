import { obterSessao } from "./sessao";
import { temPermissao } from "./permissoes";
import { auditarIdentidade } from "./repositorio";
import { db } from "../db/client";

export async function administradorHttp() {
  const sessao = await obterSessao();
  if (!sessao) return { erro: 401 as const };
  if (!temPermissao(sessao, "super_admin")) {
    await auditarIdentidade(db(), sessao.userId, "acesso_403");
    return { erro: 403 as const };
  }
  return { sessao };
}
