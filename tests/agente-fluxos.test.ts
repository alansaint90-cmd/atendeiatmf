import test from "node:test";
import assert from "node:assert/strict";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { chatbotSchema } from "../src/lib/chatbots/schema";
import { configurarAgente } from "../src/lib/agent/config";
import { incomingMessage } from "../src/lib/agent/message";
import { processMessage, type DeliveryState } from "../src/lib/agent/processor";
import { fluxoAcionado } from "../src/lib/agent/fluxos";

const configuracao = () => configurarAgente({ AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
  EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "levaelava",
  REDIS_URL: "redis://localhost:6379" }, chatbotSchema.parse({ ...chatbotExample, context: "Endereço e Maps cadastrados. Aberta 24 horas.",
  flows: [{ name: "Promoção", description: "Explique R$ 13,90 das 00h às 06h e envie o endereço e Maps do prompt.",
    triggers: ["quero saber sobre a promoção de 13,90", "quero saber mais sobre a promoção de 13,90"] }] })).data!;

test("frase recebida da Evolution ativa o fluxo salvo mesmo em conversa antiga e não repete na próxima pergunta", async () => {
  const config = configuracao();
  for (const texto of ["quero saber sobre a promoção de 13,90", "QUERO SABER SOBRE A PROMOCAO DE R$ 13.90!", "Qual o horário?"]) {
    const mensagem = incomingMessage({ instance: "levaelava", event: "messages.upsert", data: {
      key: { remoteJid: "551199998888@s.whatsapp.net", remoteJidAlt: "551199998888@s.whatsapp.net", fromMe: false, id: texto, addressingMode: "lid" },
      messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: texto } } }, "levaelava")!;
    assert.ok(mensagem);
    let estado: DeliveryState | null = null;
    const resultado = await processMessage(mensagem, config, { read: async () => estado, write: async valor => { estado = valor; },
      enabled: async () => true, history: async () => [{ role: "user", content: "Quero saber de outros serviços." }],
      generate: async atual => {
        assert.match(atual.AI_SYSTEM_PROMPT, /Endereço e Maps cadastrados/);
        if (texto.includes("horário")) assert.doesNotMatch(atual.AI_SYSTEM_PROMPT, /FLUXO ATIVADO PARA ESTA MENSAGEM/);
        else assert.match(atual.AI_SYSTEM_PROMPT, /FLUXO ATIVADO PARA ESTA MENSAGEM: Promoção/);
        return "Resposta do fluxo ou do prompt atual.";
      }, send: async () => "saida-simulada", complete: async () => {} });
    assert.equal(resultado, "enviada");
  }
});

test("frases salvas rejeitam preço diferente, pedidos negados e o gatilho de outro chatbot", () => {
  const config = configuracao();
  for (const texto of ["não quero saber sobre a promoção de 13,90", "quero saber sobre a promoção de 13,99", "quero saber sobre a promoção de 14,90", "Oi"]) {
    assert.equal(fluxoAcionado(config.flows, texto), undefined);
  }
  assert.equal(fluxoAcionado([], "quero saber sobre a promoção de 13,90"), undefined);
  assert.equal(fluxoAcionado(config.flows, "Quero saber sobre a promoção de 13,90." )?.name, "Promoção");
  assert.equal(fluxoAcionado(config.flows, "Quero saber sobre a promoção de 13,90," )?.name, "Promoção");
});

test("gatilho de cliente não contorna pausa humana", async () => {
  assert.equal(await processMessage({ identity: "teste", conversation: "teste", number: "5511999999999",
    text: "quero saber sobre a promoção de 13,90", timestamp: Date.now() / 1000 }, configuracao(), {
    read: async () => null, write: async () => {}, history: async () => [], enabled: async () => false,
    generate: async () => { assert.fail("Não gerar durante pausa"); }, send: async () => { assert.fail("Não enviar durante pausa"); },
    complete: async () => {} }), "pausada");
});
