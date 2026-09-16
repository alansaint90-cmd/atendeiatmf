import { randomUUID } from "node:crypto";
import { z } from "zod";
import { effectiveSettings } from "../settings/repository";
import { evolutionEventSchema } from "../evolution/schema";
import { streamKey } from "../evolution/queue";
import { agentConfigSchema } from "./config";
import { incomingMessage } from "./message";
import { generateReply, sendReply } from "./providers";
import { processMessage } from "./processor";
import { agentRedis, agentKeys, owned } from "./redis";
import { finishEvent, messageStore } from "./store";

const streamResult = z.array(z.tuple([z.string(), z.array(z.tuple([z.string(), z.array(z.string())]))]));
let started = false;
let lastLog = "";
function report(status: string) {
  if (lastLog !== status) { console.info(`AtendeIA agente: ${status}`); lastLog = status; }
}

export async function runAgentTick(dependencies = { settings: effectiveSettings, generate: generateReply, send: sendReply }) {
  const settings = await dependencies.settings();
  if (!settings.REDIS_URL) { report("Redis não configurado"); return; }
  const client = agentRedis(settings.REDIS_URL);
  const token = randomUUID();
  try {
    await client.connect();
    if (!await client.set(agentKeys.lock, token, "PX", 120000, "NX")) return;
    const config = agentConfigSchema.safeParse(settings);
    const status = settings.AI_ENABLED !== "true" ? "desativado" : config.success ? "ativo" : "configuracao_incompleta";
    const previous = await client.get(agentKeys.heartbeat);
    const last = previous ? JSON.parse(previous) as { lastResult?: string; lastCode?: string; lastAt?: string } : {};
    await client.set(agentKeys.heartbeat, JSON.stringify({ status, at: new Date().toISOString(),
      lastResult: last.lastResult, lastCode: last.lastCode, lastAt: last.lastAt }), "EX", 180);
    report(status);
    if (!config.success) return;
    try { await client.xgroup("CREATE", streamKey, agentKeys.group, "0", "MKSTREAM"); }
    catch (error) { if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error; }
    // Consumidor fixo + lease global recuperam o primeiro pendente antes de ler novos.
    let raw = await client.xreadgroup("GROUP", agentKeys.group, agentKeys.consumer, "COUNT", 1, "STREAMS", streamKey, "0");
    let entries = streamResult.parse(raw ?? [])[0]?.[1] ?? [];
    if (!entries.length) {
      raw = await client.xreadgroup("GROUP", agentKeys.group, agentKeys.consumer, "COUNT", 1, "STREAMS", streamKey, ">");
      entries = streamResult.parse(raw ?? [])[0]?.[1] ?? [];
    }
    for (const [id, fields] of entries) {
      const payload = fields[fields.indexOf("payload") + 1] ?? "{}";
      let value: unknown;
      try { value = JSON.parse(payload); } catch { value = null; }
      const parsed = evolutionEventSchema.safeParse(value);
      const message = parsed.success ? incomingMessage(parsed.data, config.data.EVOLUTION_INSTANCE_NAME) : null;
      let result = "ignorada";
      if (message) {
        const store = messageStore(client, token, message);
        result = await processMessage(message, config.data, {
          ...store, generate: dependencies.generate, send: dependencies.send,
          enabled: async () => {
            const current = agentConfigSchema.safeParse(await dependencies.settings());
            return current.success && JSON.stringify(current.data) === JSON.stringify(config.data)
              && await client.get(agentKeys.lock) === token;
          },
        });
        const state = await store.read();
        await client.set(agentKeys.heartbeat, JSON.stringify({ status: "ativo", at: new Date().toISOString(),
          lastResult: result, lastCode: state?.code ?? null, lastAt: new Date().toISOString() }), "EX", 180);
      }
      if (result !== "repetir" && result !== "pausada") {
        const archive = JSON.stringify({ event: parsed.success ? parsed.data.event : "invalido", message });
        await finishEvent(client, token, id, archive, result);
      }
      report(result);
      return result !== "repetir" && result !== "pausada";
    }
  } finally {
    if (client.status === "ready") await client.eval(owned + "redis.call('DEL', KEYS[1]); return 1", 1, agentKeys.lock, token).catch(() => {});
    client.disconnect();
  }
}

export function startAgentWorker() {
  if (started) return;
  started = true;
  const loop = async () => {
    let processed = false;
    try { processed = Boolean(await runAgentTick()); }
    catch { report("falha de configuração, Redis ou processamento; nova tentativa em 5 segundos"); }
    const timer = setTimeout(() => void loop(), processed ? 100 : 5000);
    timer.unref();
  };
  void loop();
}
