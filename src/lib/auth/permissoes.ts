import { ErroDeNegocio } from "@/lib/acao";
import { PAPEIS, type Papel } from "@/lib/db/schema/_enums";

export interface SessaoAtiva {
  userId: string;
  papel: Papel;
}

/**
 * UNICA checagem de permissao do projeto: o papel da sessao alcanca o papel
 * minimo exigido? (`PAPEIS` vai do maior para o menor privilegio.)
 * A matriz "qual papel minimo para cada acao" fica em docs/rbac.md.
 */
export function temPermissao(sessao: SessaoAtiva | null, papelMinimo: Papel): boolean {
  if (!sessao) return false;
  const atual = PAPEIS.indexOf(sessao.papel);
  const minimo = PAPEIS.indexOf(papelMinimo);
  return atual >= 0 && minimo >= 0 && atual <= minimo;
}

export function exigirPermissao(sessao: SessaoAtiva, papelMinimo: Papel): void {
  if (!temPermissao(sessao, papelMinimo)) throw new ErroDeNegocio("Sem permissao para esta acao.");
}
