import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { agentRedis, agentKeys } from "../src/lib/agent/redis";
import { messageStore } from "../src/lib/agent/store";
import { runAgentTick } from "../src/lib/agent/worker";
import { incomingMessage } from "../src/lib/agent/message";
import { streamKey } from "../src/lib/evolution/queue";
import type { AgentConfig } from "../src/lib/agent/config";
import type { EvolutionEvent } from "../src/lib/evolution/schema";
import { defaultFollowup } from "../src/lib/followups/schema";
import { followupStore, followupQueue } from "../src/lib/followups/queue";

test("Redis real: recuperação de pendentes, Lua atômico e exclusão de envio duplicado", { skip: !process.env.TEST_REDIS_URL }, async () => {
  const url = process.env.TEST_REDIS_URL!;
  const target = new URL(url);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === "/15", "Use apenas Redis descartável local, banco 15.");
  const client = agentRedis(url);
  await client.connect();
  const config: AgentConfig = { AI_ENABLED: "true", AI_SYSTEM_PROMPT: "Teste", OPENAI_API_KEY: "sk-test-only",
    OPENAI_MODEL: "modelo-teste", EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste",
    EVOLUTION_INSTANCE_NAME: "teste", REDIS_URL: url };
  const event: EvolutionEvent = { event: "messages.upsert", instance: "teste", data: { key: {
    id: randomUUID(), fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
  messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: "Oi" } } };
  const message = incomingMessage(event, "teste")!;
  let sends = 0;
  const dependencies = { settings: async () => config, generate: async () => "Olá", send: async () => { sends++; return "enviado"; } };
  try {
    assert.equal(await client.xlen(streamKey), 0, "Fila de testes deve estar vazia.");
    await client.xgroup("CREATE", streamKey, agentKeys.group, "0", "MKSTREAM").catch(error => {
      if (!String(error).includes("BUSYGROUP")) throw error;
    });
    await client.xadd(streamKey, "*", "payload", JSON.stringify(event));
    // Simular interrupção após reservar evento, antes do processamento.
    await client.xreadgroup("GROUP", agentKeys.group, agentKeys.consumer, "COUNT", 1, "STREAMS", streamKey, ">");
    await runAgentTick(dependencies);
    assert.equal(sends, 1);
    assert.equal(await client.xlen(streamKey), 0);
    assert.equal((await messageStore(client, "sem-posse", message).read())?.status, "enviada");
    assert.equal((await messageStore(client, "sem-posse", message).history()).length, 2);
    await client.xadd(streamKey, "*", "payload", JSON.stringify({ ...event, date_time: "outro-envelope" }));
    await runAgentTick(dependencies);
    assert.equal(sends, 1);
    assert.equal(await client.xlen(streamKey), 0);
    assert.ok(await client.xlen(agentKeys.archive) >= 2);
    const lease = randomUUID();
    await client.set(agentKeys.lock, lease, "PX", 120000);
    const followups = followupStore(client, lease);
    const schedule = structuredClone(defaultFollowup);
    schedule.enabled = true; schedule.instance = "teste"; schedule.revision = randomUUID(); schedule.steps[0].enabled = true;
    await followups.schedule(message, schedule);
    const jobKey = `atendeia:{evolution}:followup:${message.conversation}`;
    const original = await client.get(jobKey);
    assert.ok(original);
    await followups.schedule(message, schedule);
    assert.equal(await client.get(jobKey), original, "Duplicata não reinicia o prazo.");
    await followups.outgoing("teste", "eco-teste");
    await followups.observe({ ...event, data: { ...event.data, key: { id: "eco-teste", fromMe: true, remoteJid: "5511999999999@s.whatsapp.net" } } }, "teste");
    assert.equal(await client.get(jobKey), original, "Eco do agente preserva a sequência.");
    const job = JSON.parse(original);
    await followups.save({ ...job, due: Date.now() - 1 });
    assert.equal((await followups.due())?.identity, message.identity);
    await followups.observe({ ...event, data: { ...event.data, message: { imageMessage: {} },
      key: { id: "nova-atividade", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" } } }, "teste");
    assert.equal(await client.get(jobKey), null, "Nova atividade cancela inclusive mídia.");
    assert.equal(await client.zscore(followupQueue, message.conversation), null);
    await client.set(agentKeys.lock, "outro-processo", "PX", 120000);
    await assert.rejects(messageStore(client, "posse-antiga", message).write({ status: "enviando", attempts: 1 }));
    await runAgentTick(dependencies);
    assert.equal(sends, 1);
  } finally {
    await client.del(streamKey, agentKeys.lock, agentKeys.heartbeat, agentKeys.archive,
      `atendeia:{evolution}:reply:${message.identity}`, `atendeia:{evolution}:history:${message.conversation}`);
    client.disconnect();
  }
});
