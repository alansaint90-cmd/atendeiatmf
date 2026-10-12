import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { agentRedis, agentKeys } from "../../src/lib/agent/redis";
import { streamKey, enqueueEvolutionEventWithClient } from "../../src/lib/evolution/queue";
import { runAgentTick } from "../../src/lib/agent/worker";
import { chatbotExample } from "../../src/lib/chatbots/defaults";
import { incomingMessage } from "../../src/lib/agent/message";
import { messageStore } from "../../src/lib/agent/store";
import type { EvolutionEvent } from "../../src/lib/evolution/schema";

test("Redis: chatbot com erro não bloqueia os demais chips e recupera o pendente em ordem", { skip: !process.env.TEST_REDIS_URL }, async () => {
  const url = process.env.TEST_REDIS_URL!;
  const alvo = new URL(url);
  assert.ok(["localhost", "127.0.0.1"].includes(alvo.hostname) && alvo.pathname === "/15");
  const client = agentRedis(url); await client.connect();
  const instancias = ["primeiro", "segundo", "terceiro"].map(nome => `${nome}-${randomUUID()}`);
  const eventos: EvolutionEvent[] = [instancias[0], instancias[0], instancias[1], instancias[2]].map(instance => ({
    instance, event: "messages.upsert", data: { key: { id: randomUUID(), fromMe: false,
      remoteJid: "5511998877665@s.whatsapp.net" }, messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: "Olá" } },
  }));
  const saidas: string[] = [];
  let falha = true;
  const dependencias = {
    settings: async () => ({ AI_ENABLED: "true" as const, REDIS_URL: url, OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
      EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: instancias[0],
      EVOLUTION_SECOND_INSTANCE_NAME: instancias[1], EVOLUTION_THIRD_INSTANCE_NAME: instancias[2] }),
    chatbot: async (instancia: string) => {
      if (instancia === instancias[0] && falha) throw new Error("Erro privado com credencial simulada");
      return { ...chatbotExample, context: "Atenda conforme o prompt atual." };
    },
    generate: async () => "Resposta de teste", registrarEnvio: async () => {},
    send: async (config: { EVOLUTION_INSTANCE_NAME: string }) => { saidas.push(config.EVOLUTION_INSTANCE_NAME); return randomUUID(); },
  };
  try {
    await client.del(agentKeys.lastInstance);
    for (const evento of eventos) await enqueueEvolutionEventWithClient(client, evento);
    assert.equal(await runAgentTick(dependencias), false);
    const diagnostico = JSON.parse((await client.get(agentKeys.heartbeat))!);
    assert.equal(diagnostico.status, "falha");
    assert.equal(diagnostico.lastCode, "falha_leitura_chatbot");
    assert.equal(diagnostico.lastInstance, instancias[0]);
    assert.ok(!JSON.stringify(diagnostico).includes("credencial"));
    assert.equal(await client.xlen(streamKey), 4, "Evento com erro é preservado.");
    await runAgentTick(dependencias); await runAgentTick(dependencias);
    assert.deepEqual(saidas, [instancias[1], instancias[2]]);
    falha = false;
    await runAgentTick(dependencias);
    const primeira = incomingMessage(eventos[0], instancias[0])!;
    const seguinte = incomingMessage(eventos[1], instancias[0])!;
    assert.equal((await messageStore(client, "sem-posse", primeira).read())?.status, "enviada");
    assert.equal(await messageStore(client, "sem-posse", seguinte).read(), null, "Ordem do chip preservada.");
    await runAgentTick(dependencias);
    assert.deepEqual(saidas, [instancias[1], instancias[2], instancias[0], instancias[0]]);
    assert.equal(await client.xlen(streamKey), 0);
    // Resultado perdido durante envio permanece incerto; nunca reenviar ao recuperar.
    const lease = randomUUID(); await client.set(agentKeys.lock, lease, "PX", 120000);
    await messageStore(client, lease, primeira).write({ status: "enviando", attempts: 1 });
    await client.del(agentKeys.lock);
    await client.xadd(streamKey, "*", "payload", JSON.stringify(eventos[0]));
    await runAgentTick(dependencias);
    assert.equal((await messageStore(client, "sem-posse", primeira).read())?.status, "incerta");
    assert.equal(saidas.length, 4);
  } finally {
    await client.del(streamKey, agentKeys.lock, agentKeys.heartbeat, agentKeys.archive, agentKeys.lastInstance);
    for (const evento of eventos) {
      const mensagem = incomingMessage(evento, evento.instance)!;
      await client.del(`atendeia:{evolution}:reply:${mensagem.identity}`, `atendeia:{evolution}:history:${mensagem.conversation}`,
        `atendeia:{evolution}:name:${mensagem.conversation}`);
    }
    client.disconnect();
  }
});

test("Redis: confirmação de leitura não depende de carregar chatbot e libera a fila", { skip: !process.env.TEST_REDIS_URL }, async () => {
  const url = process.env.TEST_REDIS_URL!;
  const alvo = new URL(url);
  assert.ok(["localhost", "127.0.0.1"].includes(alvo.hostname) && alvo.pathname === "/15");
  const client = agentRedis(url); await client.connect();
  try {
    await enqueueEvolutionEventWithClient(client, { instance: "teste-status", event: "messages.update", data: { status: "READ" } });
    await runAgentTick({ settings: async () => ({ AI_ENABLED: "true", REDIS_URL: url, OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
      EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "teste-status" }),
    chatbot: async () => { throw new Error("Status não deve consultar chatbot"); } });
    assert.equal(await client.xlen(streamKey), 0);
  } finally {
    await client.del(streamKey, agentKeys.lock, agentKeys.heartbeat, agentKeys.archive, agentKeys.lastInstance);
    client.disconnect();
  }
});
