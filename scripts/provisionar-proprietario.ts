import { randomUUID } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, closeDatabase } from "../src/lib/db/client";
import { ensureDatabase } from "../src/lib/db/migrate";
import { hashToken, novoToken, auditarIdentidade } from "../src/lib/auth/repositorio";
import { systemUserId } from "../src/lib/db/bootstrap";
import { configuracaoPasskey } from "../src/lib/auth/passkeys";

// Execução manual com acesso administrativo ao servidor. Nunca no entrypoint ou seed.
async function main() {
  const config = z.strictObject({ nome: z.string().trim().min(2).max(120), email: z.email(), arquivo: z.string().min(1) }).parse({
    nome: process.env.PROVISIONAR_NOME, email: process.env.PROVISIONAR_EMAIL, arquivo: process.env.PROVISIONAR_ARQUIVO,
  });
  configuracaoPasskey();
  const solicitado = path.resolve(config.arquivo);
  const destino = path.join(await realpath(path.dirname(solicitado)), path.basename(solicitado));
  const relativo = path.relative(await realpath(process.cwd()), destino);
  if (!relativo.startsWith(".." + path.sep) && !path.isAbsolute(relativo)) throw new Error("Use uma pasta privada fora do repositório para o convite.");
  await ensureDatabase();
  const token = novoToken(); const id = randomUUID();
  // Não sobrescreve um arquivo existente e não exibe o convite em logs.
  const arquivo = await open(destino, "wx", 0o600);
  try {
    if (process.platform === "win32") {
      if (!process.env.USERDOMAIN || !process.env.USERNAME) throw new Error("Identidade local indisponível.");
      execFileSync("icacls.exe", [destino, "/inheritance:r", "/grant:r", `${process.env.USERDOMAIN}\\${process.env.USERNAME}:F`], { windowsHide: true, stdio: "ignore" });
    }
    await arquivo.writeFile(token, "utf8");
  } finally { await arquivo.close(); }
  await db().transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(712940862)`);
    const existentes = await tx.execute(sql`SELECT id FROM atendeia_users WHERE role='super_admin' AND is_deleted=false`);
    if (existentes.length) throw new Error("Já existe proprietário. O provisionamento inicial não pode ser repetido.");
    await tx.execute(sql`INSERT INTO atendeia_users(id,name,email,role,enabled,modified_by) VALUES (${id},${config.nome},${config.email},'super_admin',false,${systemUserId})`);
    await tx.execute(sql`INSERT INTO atendeia_users_convites(user_id,token_hash,expira_em,modified_by) VALUES (${id},${hashToken(token)},now()+interval '15 minutes',${systemUserId})`);
    await auditarIdentidade(tx, systemUserId, "proprietario_provisionado", id);
  });
  console.log("Proprietário provisionado. O convite foi salvo no arquivo privado informado e expira em 15 minutos.");
}
main().catch(() => { console.error("Provisionamento não concluído. Confira configuração, arquivo privado e existência de proprietário. Nenhuma credencial foi exibida."); process.exitCode = 1; }).finally(closeDatabase);
