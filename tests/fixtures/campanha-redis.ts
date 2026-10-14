import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { agentRedis, agentKeys } from "../../src/lib/agent/redis";
import { messageStore } from "../../src/lib/agent/store";
import { incomingMessage } from "../../src/lib/agent/message";

test("Redis: reserva da campanha é atômica, persistente e isolada por chip/cliente", { skip: !process.env.TEST_REDIS_URL }, async () => {
  const url = process.env.TEST_REDIS_URL!; const alvo = new URL(url);
  assert.ok(["localhost", "127.0.0.1"].includes(alvo.hostname) && alvo.pathname === "/15");
  const client = agentRedis(url); await client.connect(); const token = randomUUID();
  const mensagens = ["chip-a", "chip-b", "chip-a"].map((instance, i) => incomingMessage({ instance, event: "messages.upsert",
    data: { key: { id: randomUUID(), fromMe: false, remoteJid: `${i === 2 ? "5511888877777" : "5511999988888"}@s.whatsapp.net` },
      messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: "campanha" } } }, instance)!);
  const chave = `teste-${randomUUID()}`;
  try {
    await client.set(agentKeys.lock, token);
    const loja = messageStore(client, token, mensagens[0]);
    const reservas = await Promise.all([loja.reservarFluxo(chave), loja.reservarFluxo(chave)]);
    assert.equal(reservas.filter(Boolean).length, 1);
    assert.equal(await client.ttl(`atendeia:{evolution}:fluxo:${mensagens[0].conversation}:${chave}`), -1);
    for (const mensagem of mensagens.slice(1)) assert.equal(await messageStore(client, token, mensagem).reservarFluxo(chave), true);
    assert.equal(await messageStore(client, token, { ...mensagens[0], identity: randomUUID() }).reservarFluxo(chave), false);
  } finally {
    await client.del(agentKeys.lock, ...mensagens.map(m => `atendeia:{evolution}:fluxo:${m.conversation}:${chave}`));
    client.disconnect();
  }
});
