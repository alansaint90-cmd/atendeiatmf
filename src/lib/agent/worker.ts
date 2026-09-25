import { randomUUID } from "node:crypto";
import { z } from "zod";
import { effectiveSettings } from "../settings/repository";
import { evolutionEventSchema } from "../evolution/schema";
import { streamKey } from "../evolution/queue";
import { configurarAgente } from "./config";
import { incomingMessage, digest } from "./message";
import { generateReply, sendReply } from "./providers";
import { transcribeAudio } from "./audio";
import { processMessage } from "./processor";
import { agentRedis, agentKeys, owned } from "./redis";
import { finishEvent, messageStore } from "./store";
import { parseFollowup } from "../followups/schema";
import { followupStore } from "../followups/queue";
import { configuracaoPermiteFollowup, processFollowup } from "../followups/processor";
import { executarAgendamentos } from "../agendamentos/worker";
import { chatbotDaInstancia } from "../chatbots/server-repository";
import { db } from "../db/client";
import { registrarEnvioIa } from "../operacao/atribuir-ia";

const streamResult = z.array(z.tuple([z.string(), z.array(z.tuple([z.string(), z.array(z.string())]))]));
let started = false;
let lastLog = "";
function report(status: string) {
  if (lastLog !== status) { console.info(`Atende AI agente: ${status}`); lastLog = status; }
}

const dependenciasPadrao = { settings: effectiveSettings, generate: generateReply, send: sendReply,
  chatbot: (instancia: string) => chatbotDaInstancia(db(), instancia) };
export async function runAgentTick(substituicoes: Partial<typeof dependenciasPadrao> = {}) {
  const dependencies = { ...dependenciasPadrao, ...substituicoes,
    chatbot: substituicoes.chatbot ?? (Object.keys(substituicoes).length ? async () => null : dependenciasPadrao.chatbot) };
  const settings = await dependencies.settings();
  if (!settings.REDIS_URL) { report("Redis não configurado"); return; }
  const client = agentRedis(settings.REDIS_URL);
  const token = randomUUID();
  try {
    await client.connect();
    if (!await client.set(agentKeys.lock, token, "PX", 120000, "NX")) return;
    const chatbot = settings.EVOLUTION_INSTANCE_NAME ? await dependencies.chatbot(settings.EVOLUTION_INSTANCE_NAME) : null;
    const config = configurarAgente(settings, chatbot);
    const status = settings.AI_ENABLED !== "true" ? "desativado" : config.success ? "ativo" : "configuracao_incompleta";
    const previous = await client.get(agentKeys.heartbeat);
    const last = previous ? JSON.parse(previous) as { lastResult?: string; lastCode?: string; lastAt?: string } : {};
    await client.set(agentKeys.heartbeat, JSON.stringify({ status, at: new Date().toISOString(),
      lastResult: last.lastResult, lastCode: last.lastCode, lastAt: last.lastAt }), "EX", 180);
    report(status);
    if (!config.success) return;
    const followups = followupStore(client, token);
    const followupConfig = parseFollowup(settings.FOLLOW_UP_CONFIG);
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
      if (parsed.success) await followups.observe(parsed.data, config.data.EVOLUTION_INSTANCE_NAME);
      const message = parsed.success ? incomingMessage(parsed.data, config.data.EVOLUTION_INSTANCE_NAME) : null;
      let result = "ignorada";
      if (message) {
        const store = messageStore(client, token, message);
        result = await processMessage(message, config.data, {
          ...store, generate: dependencies.generate, send: dependencies.send, transcribe: transcribeAudio,
          enabled: async () => {
            const currentSettings = await dependencies.settings();
            const currentBot = currentSettings.EVOLUTION_INSTANCE_NAME
              ? await dependencies.chatbot(currentSettings.EVOLUTION_INSTANCE_NAME) : null;
            const current = configurarAgente(currentSettings, currentBot);
            return current.success && JSON.stringify(current.data) === JSON.stringify(config.data)
              && await client.get(agentKeys.lock) === token;
          },
        });
        const state = await store.read();
        if (state?.status === "enviada" && state.providerId) {
          await registrarEnvioIa(db(), config.data.EVOLUTION_INSTANCE_NAME, state.providerId);
          await followups.outgoing(config.data.EVOLUTION_INSTANCE_NAME, state.providerId);
          if (followupConfig.instance === config.data.EVOLUTION_INSTANCE_NAME && state.configHash === digest(JSON.stringify(config.data))) {
            await followups.schedule(message, followupConfig);
          }
        }
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
    const job = await followups.due();
    if (job) {
      await processFollowup(job, followupConfig, {
        save: followups.save, finish: result => followups.finish(job, result),
        enabled: async () => {
          const currentSettings = await dependencies.settings();
          const currentFollowup = parseFollowup(currentSettings.FOLLOW_UP_CONFIG);
          const currentBot = currentSettings.EVOLUTION_INSTANCE_NAME
            ? await dependencies.chatbot(currentSettings.EVOLUTION_INSTANCE_NAME) : null;
          const current = configurarAgente(currentSettings, currentBot);
          return current.success && JSON.stringify(current.data) === JSON.stringify(config.data)
            && configuracaoPermiteFollowup(job, currentFollowup)
            && currentFollowup.instance === config.data.EVOLUTION_INSTANCE_NAME
            && await client.get(agentKeys.lock) === token && await client.xlen(streamKey) === 0;
        },
        send: (number, text) => dependencies.send(config.data, number, text),
        delivered: async (id, text) => {
          await followups.outgoing(config.data.EVOLUTION_INSTANCE_NAME, id);
          await followups.history(job, text);
        },
      });
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
    try { await executarAgendamentos(); }
    catch { console.error("Atende AI: falha ao processar agendamentos; confira banco e configuração."); }
    try { processed = Boolean(await runAgentTick()); }
    catch { report("falha de configuração, Redis ou processamento; nova tentativa em 5 segundos"); }
    const timer = setTimeout(() => void loop(), processed ? 100 : 5000);
    timer.unref();
  };
  void loop();
}
