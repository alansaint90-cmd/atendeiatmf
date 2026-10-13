import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { systemUserId } from "../src/lib/db/bootstrap";
import { emitirRecuperacao, redefinirSenha } from "../src/lib/auth/recuperacao";
import { prepararSenha, conferirSenha } from "../src/lib/auth/senhas";
import { criarSessao, lerSessao, novoToken, hashToken } from "../src/lib/auth/repositorio";

test("recuperação do super administrador usa hash, expira, consome uma vez e revoga sessões sem mudar papel", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente);
  const preparar = (senha: string) => prepararSenha(senha, async () => new Response(""));
  const senha = randomBytes(24).toString("hex");
  try {
    await applyMigrations(banco);
    const anterior = await preparar(randomBytes(24).toString("hex"));
    const usuario = (await cliente.query<{ id: string }>(`INSERT INTO atendeia_users(name,email,role,enabled,password_hash,modified_by)
      VALUES ('Proprietário','dono@example.test','super_admin',true,$1,$2) RETURNING id`, [anterior.hash, systemUserId])).rows[0].id;
    const sessao = novoToken(); await banco.transaction(tx => criarSessao(tx, usuario, sessao));
    assert.ok(await lerSessao(banco, sessao));
    assert.equal(await emitirRecuperacao(banco, { email: "ausente@example.test" }), null);
    const um = (await emitirRecuperacao(banco, { email: "dono@example.test" }))!;
    const dois = (await emitirRecuperacao(banco, { email: "dono@example.test" }))!;
    assert.notEqual(um.token, dois.token);
    const registro = (await cliente.query<{ token_hash: string; valido: boolean }>(`SELECT token_hash,
      expira_em<=now()+interval '15 minutes' AND expira_em>now() AS valido FROM atendeia_users_recuperacoes LIMIT 1`)).rows[0];
    assert.equal(registro.token_hash, hashToken(um.token)); assert.equal(registro.valido, true);
    assert.ok(await lerSessao(banco, sessao), "Solicitação não encerra sessão.");
    await assert.rejects(redefinirSenha(banco, { token: um.token, senha: "curta" }, preparar));
    const concorrentes = await Promise.allSettled([
      redefinirSenha(banco, { token: um.token, senha }, preparar),
      redefinirSenha(banco, { token: dois.token, senha }, preparar),
    ]);
    assert.equal(concorrentes.filter(item => item.status === "fulfilled").length, 1, "Somente um link concorrente pode trocar a senha.");
    assert.equal(await lerSessao(banco, sessao), null);
    await assert.rejects(redefinirSenha(banco, { token: um.token, senha }, preparar));
    await assert.rejects(redefinirSenha(banco, { token: dois.token, senha }, preparar));
    const atual = (await cliente.query<{ password_hash: string; role: string; enabled: boolean }>("SELECT password_hash,role,enabled FROM atendeia_users WHERE id=$1", [usuario])).rows[0];
    assert.equal(await conferirSenha(senha, atual.password_hash), true);
    assert.equal(atual.role, "super_admin"); assert.equal(atual.enabled, true);
    const tres = (await emitirRecuperacao(banco, { email: "dono@example.test" }))!;
    await cliente.query("UPDATE atendeia_users_recuperacoes SET expira_em=now()-interval '1 minute' WHERE is_deleted=false");
    await assert.rejects(redefinirSenha(banco, { token: tres.token, senha }, preparar));
    assert.equal(await emitirRecuperacao(banco, { email: "dono@example.test" }), null, "Limite por conta.");
    await cliente.query("UPDATE atendeia_auth_limites SET janela=now()-interval '2 minutes'");
    const quatro = (await emitirRecuperacao(banco, { email: "dono@example.test" }))!;
    await cliente.query("UPDATE atendeia_users SET version=version+1 WHERE id=$1", [usuario]);
    await assert.rejects(redefinirSenha(banco, { token: quatro.token, senha }, preparar));
    await cliente.query("UPDATE atendeia_users SET enabled=false WHERE id=$1", [usuario]);
    assert.equal(await emitirRecuperacao(banco, { email: "dono@example.test" }), null);
    const auditoria = JSON.stringify((await cliente.query("SELECT action,details FROM atendeia_audit_logs")).rows);
    assert.match(auditoria, /senha_recuperada/);
    assert.ok(!auditoria.includes(um.token) && !auditoria.includes(senha));
  } finally { await cliente.close(); }
});
