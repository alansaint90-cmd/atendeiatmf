import { isSettingsAdmin } from "@/lib/settings/security";
import { environmentSettings, readSettings, saveSettings, SettingsConflict } from "@/lib/settings/repository";
import { saveSettingsSchema, settingsStatus } from "@/lib/settings/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function unavailable() {
  return json({ error: "Não foi possível acessar as configurações. Confira DATABASE_URL, SETTINGS_ENCRYPTION_KEY e a conexão/permissão do PostgreSQL no servidor." }, 503);
}

export async function GET(request: Request) {
  if (!isSettingsAdmin(request)) return json({ error: "Informe o token de administrador configurado no servidor (mínimo de 32 caracteres)." }, 401);
  try {
    const result = await readSettings();
    return json(settingsStatus({ ...environmentSettings(), ...result.values }, result.version));
  } catch { return unavailable(); }
}

export async function PUT(request: Request) {
  if (!isSettingsAdmin(request)) return json({ error: "Acesso de administrador necessário." }, 401);
  const origin = request.headers.get("origin");
  // Host is preserved by the reverse proxy even when Next's internal URL uses localhost.
  if (origin) {
    try {
      if (new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)) return json({ error: "Origem não permitida." }, 403);
    } catch { return json({ error: "Origem não permitida." }, 403); }
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ error: "Envie JSON." }, 415);
  if (Number(request.headers.get("content-length")) > 32768) return json({ error: "Conteúdo muito grande." }, 413);
  let input: unknown;
  try {
    if (!request.body) return json({ error: "Corpo vazio." }, 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) { await reader.cancel(); return json({ error: "Conteúdo muito grande." }, 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return json({ error: "JSON inválido." }, 400); }
  const parsed = saveSettingsSchema.safeParse(input);
  if (!parsed.success) return json({ error: "Campos inválidos: " + [...new Set(parsed.error.issues.map(issue => issue.path.join(".")))].join(", ") }, 422);
  try {
    const result = await saveSettings(parsed.data.values, parsed.data.version);
    return json(settingsStatus({ ...environmentSettings(), ...result.values }, result.version));
  } catch (error) {
    if (error instanceof SettingsConflict) return json({ error: "Outra sessão alterou as configurações. Recarregue antes de salvar." }, 409);
    return unavailable();
  }
}
