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
import { chatbotExample } from "../src/lib/chatbots/defaults";

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
  let generations = 0;
  const textosEnviados: string[] = [];
  const registros: string[] = [];
  const dependencies = { settings: async () => config,
    chatbot: async () => ({ ...chatbotExample, context: "Atenda o cliente conforme este roteiro de teste." }),
    registrarEnvio: async (instancia: string, id: string) => { registros.push(`${instancia}:${id}`); },
    generate: async () => { generations++; return "Olá"; },
    send: async (_config: Pick<AgentConfig, "EVOLUTION_API_URL" | "EVOLUTION_API_KEY" | "EVOLUTION_INSTANCE_NAME">, _numero: string, texto: string) => {
      sends++; textosEnviados.push(texto); return `enviado-${sends}`;
    } };
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
    assert.deepEqual(registros, ["teste:enviado-1"]);
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
    await messageStore(client, lease, message).rememberName("Alan");
    assert.equal(await messageStore(client, "sem-posse", message).contactName(), "Alan");
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
    // Simular o painel salvo: o worker deve enviar literalmente as três etapas.
    const painel = structuredClone(schedule);
    painel.startHour = 0; painel.endHour = 24;
    painel.steps.forEach((etapa, indice) => {
      etapa.enabled = true; etapa.delay = 1; etapa.unit = "minutes";
      etapa.text = `Mensagem ${indice + 1} do painel 😊\nTexto exclusivo, sem reescrita pela IA.`;
    });
    Object.assign(config, { FOLLOW_UP_CONFIG: JSON.stringify(painel) });
    await followups.schedule({ ...message, identity: randomUUID() }, painel);
    for (let indice = 0; indice < 3; indice++) {
      const pendente = JSON.parse((await client.get(jobKey))!);
      assert.equal(pendente.index, indice);
      await followups.save({ ...pendente, due: Date.now() - 1 });
      await client.del(agentKeys.lock);
      await runAgentTick(dependencies);
      assert.equal(textosEnviados.at(-1), painel.steps[indice].text);
      assert.equal(generations, 1, "Follow-up não chama a geração de IA.");
      await client.set(agentKeys.lock, lease, "PX", 120000);
    }
    assert.equal(await client.get(jobKey), null, "Última etapa encerra a sequência.");
    assert.equal(await client.zscore(followupQueue, message.conversation), null);
    assert.equal(sends, 4);
    await client.set(agentKeys.lock, "outro-processo", "PX", 120000);
    await assert.rejects(messageStore(client, "posse-antiga", message).write({ status: "enviando", attempts: 1 }));
    await runAgentTick(dependencies);
    assert.equal(sends, 4);
  } finally {
    await client.del(streamKey, agentKeys.lock, agentKeys.heartbeat, agentKeys.archive,
      `atendeia:{evolution}:reply:${message.identity}`, `atendeia:{evolution}:history:${message.conversation}`,
      `atendeia:{evolution}:name:${message.conversation}`);
    client.disconnect();
  }
});
