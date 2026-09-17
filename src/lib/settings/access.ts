import { isSettingsAdmin } from "./security";
import { ErroDeNegocio } from "../acao";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { ensureDatabase } from "../db/migrate";

export async function exigirAdmin(token: string) {
  if (typeof token !== "string" || token.length > 4096 || !isSettingsAdmin(new Request("http://localhost", {
    headers: { authorization: `Bearer ${token}` },
  }))) throw new ErroDeNegocio("Informe o token de administrador para acessar este cadastro.");
  await ensureDatabase();
  const actors = await db().execute(sql`SELECT id FROM atendeia_settings_actors WHERE id='bootstrap-admin' AND role='super_admin' AND is_deleted=false`);
  if (!actors.length) throw new ErroDeNegocio("Administrador indisponível.");
}
