import { sql } from "drizzle-orm";
import { z } from "zod";
import { linhas, type BancoSql } from "../db/porta";
import { systemUserId } from "../db/bootstrap";
import { ErroDeNegocio } from "../acao";
import { auditarIdentidade, hashToken, limitarAuth, novoToken } from "./repositorio";
import { novaSenha, prepararSenha } from "./senhas";
import { revogarAcessos } from "./usuarios";

export const pedidoRecuperacao = z.strictObject({ email: z.email().max(254).trim().toLowerCase() });
export const trocaRecuperacao = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), senha: novaSenha });
export const mensagemRecuperacao = "Se o e-mail estiver cadastrado e o acesso estiver ativo, você receberá um link para definir uma nova senha. Confira também o spam.";
const recusa = () => new ErroDeNegocio("Link inválido ou expirado. Solicite uma nova recuperação de senha.");

/** Retorno exclusivamente interno; o token nunca integra a resposta HTTP. */
export async function emitirRecuperacao(banco: BancoSql, entrada: unknown) {
  const { email } = pedidoRecuperacao.parse(entrada);
  try { await limitarAuth(banco, `recuperacao:conta:${email}`, 3); } catch { return null; }
  return banco.transaction(async tx => {
    const [usuario] = linhas<{ id: string; version: number; email: string }>(await tx.execute(sql`
      SELECT id,version,email FROM atendeia_users WHERE lower(email)=${email}
      AND enabled=true AND password_hash IS NOT NULL AND is_deleted=false FOR UPDATE`));
    if (!usuario) return null;
    const token = novoToken();
    // Solicitação não revoga sessões nem invalida links anteriores: evita negação de serviço.
    await tx.execute(sql`INSERT INTO atendeia_users_recuperacoes(user_id,token_hash,versao_usuario,expira_em,modified_by)
      VALUES (${usuario.id},${hashToken(token)},${usuario.version},now()+interval '15 minutes',${systemUserId})`);
    await auditarIdentidade(tx, systemUserId, "recuperacao_senha_solicitada", usuario.id);
    return { email: usuario.email, token };
  });
}

export async function redefinirSenha(banco: BancoSql, entrada: unknown, preparar = prepararSenha) {
  const dados = trocaRecuperacao.parse(entrada);
  await limitarAuth(banco, `recuperacao:token:${hashToken(dados.token)}`, 5);
  const [vinculo] = linhas<{ user_id: string }>(await banco.execute(sql`SELECT user_id
    FROM atendeia_users_recuperacoes WHERE token_hash=${hashToken(dados.token)}
    AND is_deleted=false AND usado_em IS NULL AND expira_em>now()`));
  if (!vinculo) throw recusa();
  const preparada = await preparar(dados.senha);
  await banco.transaction(async tx => {
    // Trava do usuário serializa consumo de links diferentes e mudança de versão.
    const [usuario] = linhas<{ version: number }>(await tx.execute(sql`SELECT version FROM atendeia_users
      WHERE id=${vinculo.user_id} AND enabled=true AND is_deleted=false FOR UPDATE`));
    if (!usuario) throw recusa();
    const usados = linhas(await tx.execute(sql`UPDATE atendeia_users_recuperacoes
      SET usado_em=now(),updated_at=now(),modified_by=${vinculo.user_id}
      WHERE token_hash=${hashToken(dados.token)} AND user_id=${vinculo.user_id}
      AND versao_usuario=${usuario.version} AND is_deleted=false AND usado_em IS NULL AND expira_em>now() RETURNING id`));
    if (!usados.length) throw recusa();
    await auditarIdentidade(tx, vinculo.user_id, "senha_recuperada");
    await tx.execute(sql`UPDATE atendeia_users SET password_hash=${preparada.hash},version=version+1,
      updated_at=now(),modified_by=${vinculo.user_id}
      WHERE id=${vinculo.user_id} AND version=${usuario.version} AND is_deleted=false`);
    await revogarAcessos(tx, vinculo.user_id, vinculo.user_id);
    await tx.execute(sql`UPDATE atendeia_users_recuperacoes SET is_deleted=true,deleted_at=now(),updated_at=now(),modified_by=${vinculo.user_id}
      WHERE user_id=${vinculo.user_id} AND is_deleted=false`);
  });
  return { aviso: preparada.aviso };
}
