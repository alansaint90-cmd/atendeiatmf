import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chatbotSchema } from "../src/lib/chatbots/schema";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { configurarAgente } from "../src/lib/agent/config";
import { processMessage, type DeliveryState, type ProcessingPort } from "../src/lib/agent/processor";
import { incomingMessage } from "../src/lib/agent/message";
import { mapsDoPrompt } from "../src/lib/agent/sequencia";
import type { Turn } from "../src/lib/agent/providers";

const sql = readFileSync("src/lib/db/migrations/0014_campanha_clara.sql", "utf8");
const fluxo = JSON.parse(sql.split("$fluxo$")[1]);
const mapa = "https://maps.app.goo.gl/UnidadeConfiguradaTeste";
const bot = chatbotSchema.parse({ ...chatbotExample, persona: "Clara", context: `Atendimento original. Localização: ${mapa}`,
  openingMessages: ["Abertura orgânica preservada."], flows: [
    { name: "Promoção orgânica", description: "Explique R$ 13,90 das 00h às 06h e envie o Maps cadastrado; tire as dúvidas.", triggers: ["quero saber sobre a promoção da madrugada"] }, fluxo] });
const config = configurarAgente({ AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
  EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "levaelava",
  REDIS_URL: "redis://localhost:6379" }, bot).data!;
function mensagem(texto = "Olá, posso ter mais informações sobre isso?", id = "entrada") {
  return incomingMessage({ instance: "levaelava", event: "messages.upsert", data: {
    key: { id, fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
    messageTimestamp: 1700000000, message: { conversation: texto } } }, "levaelava", 1700000000000)!;
}
function fixture() {
  let estado: DeliveryState | null = null; let reservado = false;
  const envios: string[] = [], ids: string[] = [], historico: Turn[] = [];
  const port: ProcessingPort = {
    read: async () => estado, write: async valor => { estado = structuredClone(valor); },
    history: async () => historico, enabled: async () => true,
    reservarFluxo: async () => { if (reservado) return false; reservado = true; return true; },
    generate: async atual => { assert.ok(!atual.AI_SYSTEM_PROMPT.includes("Campanha paga")); return "Resposta orgânica."; },
    send: async (_c, _n, texto) => { envios.push(texto); return `id-${envios.length}`; },
    registrarParte: async id => { ids.push(id); },
    complete: async (valor, turnos) => { estado = valor; historico.push(...turnos); },
  };
  return { port, envios, ids, historico, novoEvento: () => { estado = null; }, estado: () => estado };
}

test("campanha envia quatro balões exatos com Maps, sem nome, sem modelo, tolerando pontuação e acentos", async () => {
  for (const texto of ["Olá, posso ter mais informações sobre isso?", "OLA! POSSO TER MAIS INFORMACOES SOBRE ISSO..."]) {
    const f = fixture(); f.port.generate = async () => { throw new Error("Campanha não usa geração"); };
    assert.equal(await processMessage(mensagem(texto), config, f.port), "enviada");
    assert.deepEqual(f.envios, fluxo.sequencia.mensagens.map((s: string) => s.replace("{{GOOGLE_MAPS}}", mapa)));
    assert.equal(f.ids.length, 4); assert.ok(!f.envios.join(" ").includes("seu nome"));
    await processMessage(mensagem(texto), config, f.port); assert.equal(f.envios.length, 4);
    f.novoEvento(); f.historico.length = 0; // Reserva sobrevive ao diário e ao corte do histórico.
    assert.equal(await processMessage(mensagem(texto, "outro"), config, f.port), "fluxo_ja_iniciado");
    assert.equal(f.envios.length, 4);
  }
});

test("orgânico mantém abertura, perguntas genéricas e promoção no fluxo original; próxima dúvida continua normalmente", async () => {
  for (const texto of ["Oi", "Quero mais informações", "quero saber sobre a promoção da madrugada", "Qual o horário?"]) {
    const f = fixture(); let geracoes = 0;
    f.port.generate = async atual => {
      geracoes++; assert.ok(!atual.AI_SYSTEM_PROMPT.includes("Campanha paga"));
      assert.match(atual.AI_SYSTEM_PROMPT, /Atendimento original/);
      if (texto.includes("promoção")) {
        assert.match(atual.AI_SYSTEM_PROMPT, /FLUXO ATIVADO PARA ESTA MENSAGEM: Promoção orgânica/);
        assert.match(atual.AI_SYSTEM_PROMPT, /13,90 das 00h às 06h e envie o Maps/);
      }
      return "Resposta orgânica.";
    };
    await processMessage(mensagem(texto), config, f.port);
    assert.equal(f.envios.length, 1); assert.equal(geracoes, texto === "Oi" ? 0 : 1);
    if (texto === "Oi") assert.equal(f.envios[0], bot.openingMessages![0]);
  }
  const f = fixture(); await processMessage(mensagem(), config, f.port); f.novoEvento();
  await processMessage(mensagem("Qual o horário?", "seguinte"), config, f.port);
  assert.equal(f.envios.length, 5); assert.equal(f.envios[4], "Resposta orgânica.");
});

test("Maps ausente, ambíguo ou falso fica pendente sem inventar URL nem consumir a campanha", async () => {
  for (const prompt of ["Sem localização", "https://maps.app.goo.gl.evil.test/x", `${mapa} https://maps.app.goo.gl/OutraUnidade`]) {
    const f = fixture();
    assert.equal(await processMessage(mensagem(), { ...config, contextoPrincipal: prompt }, f.port), "fluxo_pendente_configuracao");
    assert.equal(f.envios.length, 0); assert.equal(f.estado()?.code, "fluxo_maps_pendente");
    f.novoEvento(); assert.equal(await processMessage(mensagem(), config, f.port), "enviada");
  }
  assert.equal(mapsDoPrompt(`[Como chegar](${mapa}).`), mapa);
});

test("pausa e entrega incerta interrompem balões sem duplicação; outros chips não usam a campanha", async () => {
  const f = fixture(); f.port.enabled = async () => f.envios.length < 2;
  assert.equal(await processMessage(mensagem(), config, f.port), "pausada"); assert.equal(f.envios.length, 2);
  f.port.enabled = async () => true;
  await processMessage(mensagem(), config, f.port); assert.equal(f.envios.length, 4);
  const incerto = fixture(); const enviar = incerto.port.send;
  incerto.port.send = async (...args) => { if (incerto.envios.length === 2) throw new Error("Timeout"); return enviar(...args); };
  assert.equal(await processMessage(mensagem(), config, incerto.port), "incerta");
  await processMessage(mensagem(), config, incerto.port); incerto.novoEvento();
  await processMessage(mensagem(undefined, "outro"), config, incerto.port); assert.equal(incerto.envios.length, 2);
  const outro = fixture(); await processMessage(mensagem(), { ...config, EVOLUTION_INSTANCE_NAME: "taistmf" }, outro.port);
  assert.equal(outro.envios.length, 1); assert.match(outro.envios[0], /Resposta orgânica/);
});
