import { z } from "zod";
import { settingsSchema } from "../settings/schema";

const configuracaoSchema = settingsSchema.pick({
  EVOLUTION_API_URL: true,
  EVOLUTION_API_KEY: true,
  EVOLUTION_INSTANCE_NAME: true,
  EVOLUTION_WEBHOOK_SECRET: true,
}).required();
const webhookSchema = z.object({
  url: z.string(),
  events: z.array(z.string().regex(/^[A-Z_]+$/)).max(100),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
  webhookByEvents: z.boolean().optional(),
  webhookBase64: z.boolean().optional(),
});
type Webhook = z.infer<typeof webhookSchema>;
const eventosNecessarios = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"];
export class ErroWebhookEvolution extends Error {}

function extrairWebhook(value: unknown): Webhook {
  const envelope = z.object({ webhook: z.unknown() }).safeParse(value);
  return webhookSchema.parse(envelope.success ? envelope.data.webhook : value);
}

async function consultar(url: string, key: string, request: typeof fetch): Promise<Webhook> {
  const response = await request(url, {
    method: "GET", redirect: "error", signal: AbortSignal.timeout(10000), headers: { apikey: key },
  });
  if (!response.ok) throw new ErroWebhookEvolution("A Evolution não permitiu consultar o webhook da instância.");
  try { return extrairWebhook(await response.json()); }
  catch { throw new ErroWebhookEvolution("A Evolution retornou uma configuração de webhook inválida."); }
}

export async function sincronizarWebhookEvolution(values: unknown, origin: string, request: typeof fetch = fetch): Promise<void> {
  const parsed = configuracaoSchema.safeParse(values);
  if (!parsed.success) throw new ErroWebhookEvolution("Preencha URL, chave, instância e segredo da Evolution antes de sincronizar.");
  const config = parsed.data;
  let app: URL;
  try { app = new URL(origin); }
  catch { throw new ErroWebhookEvolution("Configure AUTH_ORIGIN com a origem HTTPS do Atende AI."); }
  if (app.origin !== origin || (process.env.NODE_ENV === "production" && app.protocol !== "https:")) {
    throw new ErroWebhookEvolution("Configure AUTH_ORIGIN com a origem HTTPS do Atende AI.");
  }
  const api = `${config.EVOLUTION_API_URL.replace(/\/$/, "")}/webhook`;
  const endpoint = `${api}/set/${encodeURIComponent(config.EVOLUTION_INSTANCE_NAME)}`;
  const consulta = `${api}/find/${encodeURIComponent(config.EVOLUTION_INSTANCE_NAME)}`;
  const atual = await consultar(consulta, config.EVOLUTION_API_KEY, request);
  const headers = Object.fromEntries(Object.entries(atual.headers ?? {})
    .filter(([name]) => name.toLowerCase() !== "x-webhook-secret"));
  headers["x-webhook-secret"] = config.EVOLUTION_WEBHOOK_SECRET;
  const url = `${origin}/api/webhooks/evolution`;
  const events = [...new Set([...atual.events, ...eventosNecessarios])];
  let response: Response;
  try {
    response = await request(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { apikey: config.EVOLUTION_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ webhook: { enabled: true, url, headers, byEvents: false, base64: false, events } }),
    });
  } catch { throw new ErroWebhookEvolution("Não foi possível atualizar o webhook na Evolution."); }
  if (!response.ok) throw new ErroWebhookEvolution(`A Evolution recusou a configuração do webhook (HTTP ${response.status}).`);
  const confirmado = await consultar(consulta, config.EVOLUTION_API_KEY, request);
  const segredo = Object.entries(confirmado.headers ?? {}).find(([name]) => name.toLowerCase() === "x-webhook-secret")?.[1];
  if (confirmado.url !== url || segredo !== config.EVOLUTION_WEBHOOK_SECRET
    || confirmado.enabled === false || confirmado.webhookByEvents === true || confirmado.webhookBase64 === true
    || !eventosNecessarios.every(evento => confirmado.events.includes(evento))) {
    throw new ErroWebhookEvolution("A Evolution não confirmou a URL, os eventos e o cabeçalho do webhook.");
  }
}
