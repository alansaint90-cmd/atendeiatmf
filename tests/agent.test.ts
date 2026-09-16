import test from "node:test";
import assert from "node:assert/strict";
import { incomingMessage } from "../src/lib/agent/message";
import { processMessage, type DeliveryState, type ProcessingPort } from "../src/lib/agent/processor";
import { generateReply, sendReply, type Turn } from "../src/lib/agent/providers";
import { agentConfigSchema, type AgentConfig } from "../src/lib/agent/config";
import type { EvolutionEvent } from "../src/lib/evolution/schema";

const config: AgentConfig = { AI_ENABLED: "true", AI_SYSTEM_PROMPT: "Atenda com o contexto cadastrado.",
  OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "gpt-4.1-mini", EVOLUTION_API_KEY: "teste",
  EVOLUTION_API_URL: "https://evolution.example.com", EVOLUTION_INSTANCE_NAME: "teste", REDIS_URL: "redis://localhost:6379" };
const event: EvolutionEvent = { event: "messages.upsert", instance: "teste", data: {
  key: { id: "mensagem-1", fromMe: false, remoteJid: "123@lid", remoteJidAlt: "5511999999999@s.whatsapp.net" },
  messageTimestamp: 1700000000, message: { conversation: "Oi" },
} };
const message = incomingMessage(event, "teste", 1700000000000)!;

function fixture() {
  let state: DeliveryState | null = null;
  const turns: Turn[] = [];
  let sends = 0;
  let generations = 0;
  const port: ProcessingPort = {
    read: async () => state, write: async value => { state = value; }, history: async () => turns,
    complete: async (value, items) => { state = value; turns.push(...items); }, enabled: async () => true,
    generate: async () => { generations++; return "Olá! Como posso ajudar?"; },
    send: async () => { sends++; return "resposta-1"; },
  };
  return { port, state: () => state, sends: () => sends, generations: () => generations, turns };
}

test("aceita texto individual e resolve LID somente pelo telefone alternativo", () => {
  assert.equal(message.number, "5511999999999");
  assert.equal(message.text, "Oi");
  assert.equal(incomingMessage({ ...event, date_time: "outro-envelope" }, "teste", 1700000000000)?.identity, message.identity);
  assert.equal(incomingMessage(event, "outra-instancia", 1700000000000), null);
  assert.equal(incomingMessage(event, "teste", 1700000400000), null);
  assert.equal(incomingMessage({ ...event, event: "messages.update" }, "teste", 1700000000000), null);
  for (const key of [
    { id: "1", fromMe: true, remoteJid: "5511999999999@s.whatsapp.net" },
    { id: "1", fromMe: false, remoteJid: "grupo@g.us", remoteJidAlt: "5511999999999@s.whatsapp.net" },
    { id: "1", fromMe: false, remoteJid: "123@lid" },
  ]) assert.equal(incomingMessage({ ...event, data: { ...event.data, key } }, "teste", 1700000000000), null);
});

test("gera, envia, registra histórico e não responde novamente ao mesmo ID", async () => {
  const f = fixture();
  assert.equal(await processMessage(message, config, f.port), "enviada");
  assert.equal(await processMessage(message, config, f.port), "enviada");
  assert.equal(f.sends(), 1); assert.equal(f.generations(), 1);
  assert.deepEqual(f.turns.map(turn => turn.role), ["user", "assistant"]);
});

test("falha ao gerar permite três tentativas, sem enviar texto de erro", async () => {
  const f = fixture(); f.port.generate = async () => { throw new Error("credencial privada"); };
  assert.equal(await processMessage(message, config, f.port), "repetir");
  assert.equal(await processMessage(message, config, f.port), "repetir");
  assert.equal(await processMessage(message, config, f.port), "falhou");
  assert.equal(await processMessage(message, config, f.port), "falhou");
  assert.equal(f.sends(), 0); assert.ok(!JSON.stringify(f.state()).includes("credencial"));
});

test("timeout do envio e reinício durante envio não causam duplicatas", async () => {
  const f = fixture(); let sends = 0;
  f.port.send = async () => { sends++; throw new Error("timeout"); };
  assert.equal(await processMessage(message, config, f.port), "incerta");
  assert.equal(await processMessage(message, config, f.port), "incerta");
  assert.equal(sends, 1);
  const interrupted = fixture();
  await interrupted.port.write({ status: "enviando", attempts: 1, reply: "Olá" });
  assert.equal(await processMessage(message, config, interrupted.port), "incerta");
  assert.equal(interrupted.sends(), 0);
});

test("perda de persistência antes do envio impede chamada à Evolution", async () => {
  const f = fixture(); const write = f.port.write;
  f.port.write = async state => { if (state.status === "enviando") throw new Error("Redis indisponível"); await write(state); };
  await assert.rejects(processMessage(message, config, f.port));
  assert.equal(f.sends(), 0);
});

test("queda após envio confirmado não repete chamada externa", async () => {
  const f = fixture(); f.port.complete = async () => { throw new Error("Redis indisponível"); };
  await assert.rejects(processMessage(message, config, f.port));
  assert.equal(await processMessage(message, config, f.port), "incerta");
  assert.equal(f.sends(), 1);
});

test("desativação durante geração impede envio", async () => {
  const f = fixture(); let active = true;
  f.port.enabled = async () => active;
  f.port.generate = async () => { active = false; return "Olá"; };
  assert.equal(await processMessage(message, config, f.port), "pausada");
  assert.equal(f.sends(), 0);
});

test("configuração exige ativação explícita, prompt, modelo e credenciais", () => {
  assert.equal(agentConfigSchema.safeParse(config).success, true);
  for (const field of ["AI_ENABLED", "AI_SYSTEM_PROMPT", "OPENAI_MODEL", "OPENAI_API_KEY", "EVOLUTION_API_KEY"])
    assert.equal(agentConfigSchema.safeParse({ ...config, [field]: "" }).success, false);
});

test("OpenAI recebe contexto e histórico separados, sem salvar resposta no provedor", async () => {
  const fake: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.model, config.OPENAI_MODEL);
    assert.ok(body.instructions.includes(config.AI_SYSTEM_PROMPT));
    assert.deepEqual(body.input, [{ role: "assistant", content: "Olá" }, { role: "user", content: "Preciso de ajuda" }]);
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Posso ajudar." }] }] });
  };
  assert.equal(await generateReply(config, [{ role: "assistant", content: "Olá" }], "Preciso de ajuda", fake), "Posso ajudar.");
  await assert.rejects(generateReply(config, [], "Oi", async () => Response.json({ status: "incomplete", output: [] })));
  await assert.rejects(generateReply(config, [], "Oi", async () => Response.json({}, { status: 401 })), /openai_http_401/);
});

test("Evolution recebe texto e telefone corretos; exige confirmação de envio", async () => {
  const fake: typeof fetch = async (url, init) => {
    assert.equal(url, "https://evolution.example.com/message/sendText/teste");
    assert.deepEqual(JSON.parse(String(init?.body)), { number: message.number, text: "Olá", linkPreview: false });
    assert.equal(new Headers(init?.headers).get("apikey"), "teste");
    assert.equal(init?.redirect, "error");
    return Response.json({ key: { id: "sent-id" } });
  };
  assert.equal(await sendReply(config, message.number, "Olá", fake), "sent-id");
  await assert.rejects(sendReply(config, message.number, "Olá", async () => Response.json({})), /confirmacao_ausente/);
});
