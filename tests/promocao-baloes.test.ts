import test from "node:test";
import assert from "node:assert/strict";
import { processMessage, type DeliveryState, type ProcessingPort } from "../src/lib/agent/processor";
import type { AgentConfig } from "../src/lib/agent/config";
import { partesDaPromocao } from "../src/lib/agent/promocao-baloes";

const maps = "https://maps.app.goo.gl/UnidadeTeste";
const config: AgentConfig = { AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
  EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "levaelava",
  REDIS_URL: "redis://localhost:6379", AI_SYSTEM_PROMPT: "Siga o prompt atual.", contextoPrincipal: `Endereço cadastrado. ${maps}`,
  flows: [{ name: "Promoção da madrugada — R$ 13,90", description: "Explique a promoção e envie a localização.",
    triggers: ["quero saber sobre a promoção de 13,90"] }] };
const mensagem = { identity: "evento-teste", conversation: "conversa-teste", number: "5511999999999",
  timestamp: 1700000000, text: "quero saber sobre a promoção de 13,90" };
const textos = { boasVindas: "Olá, Alan! Promoção de R$ 13,90 das 00h às 06h.", endereco: "Endereço cadastrado.", cta: "Quer aproveitar essa promoção hoje?" };
function fixture() {
  let estado: DeliveryState | null = null;
  const envios: string[] = [], ids: string[] = [];
  const port: ProcessingPort = { read: async () => estado, write: async valor => { estado = structuredClone(valor); },
    history: async () => [{ role: "user", content: "Meu nome é Alan" }], enabled: async () => true,
    generate: async atual => {
      assert.match(atual.AI_SYSTEM_PROMPT, /boasVindas, endereco e cta/);
      return JSON.stringify(textos);
    },
    send: async (_config, _numero, texto) => { envios.push(texto); return `saida-${envios.length}`; },
    registrarParte: async id => { ids.push(id); }, complete: async valor => { estado = valor; } };
  return { port, envios, ids };
}
test("gatilho da promoção envia três mensagens em ordem com endereço e Maps juntos, sem duplicar evento", async () => {
  const f = fixture();
  assert.equal(await processMessage(mensagem, config, f.port), "enviada");
  assert.deepEqual(f.envios, [textos.boasVindas, `${textos.endereco}\n\n📍 ${maps}`, textos.cta]);
  assert.equal(f.ids.length, 3);
  await processMessage(mensagem, config, f.port);
  assert.equal(f.envios.length, 3);
});
test("pausa interrompe entre balões e envio incerto nunca repete partes", async () => {
  const f = fixture(); f.port.enabled = async () => f.envios.length < 1;
  assert.equal(await processMessage(mensagem, config, f.port), "pausada");
  assert.equal(f.envios.length, 1);
  const incerto = fixture(); const enviar = incerto.port.send;
  incerto.port.send = async (...args) => { if (incerto.envios.length === 1) throw new Error("Timeout simulado"); return enviar(...args); };
  assert.equal(await processMessage(mensagem, config, incerto.port), "incerta");
  await processMessage(mensagem, config, incerto.port);
  assert.equal(incerto.envios.length, 1);
});
test("demais pedidos e instâncias continuam com resposta normal", async () => {
  for (const [atual, texto] of [[config, "Qual o horário?"], [{ ...config, EVOLUTION_INSTANCE_NAME: "taistmf" }, mensagem.text]] as const) {
    const f = fixture(); f.port.generate = async instrucoes => {
      assert.doesNotMatch(instrucoes.AI_SYSTEM_PROMPT, /boasVindas, endereco e cta/); return "Atendimento normal.";
    };
    await processMessage({ ...mensagem, text: texto }, atual, f.port);
    assert.deepEqual(f.envios, ["Atendimento normal."]);
  }
});
test("formato inválido e Maps ausente não enviam bloco único ou localização inventada", () => {
  assert.throws(() => partesDaPromocao("Resposta em um bloco só", config.contextoPrincipal!));
  assert.throws(() => partesDaPromocao(JSON.stringify(textos), "Sem Maps"));
  assert.throws(() => partesDaPromocao(JSON.stringify({ ...textos, endereco: "https://example.invalid" }), config.contextoPrincipal!));
});

test("processador não envia resposta inválida e permite nova geração antes de qualquer entrega", async () => {
  const f = fixture(); const gerar = f.port.generate;
  f.port.generate = async () => "Boas-vindas, endereço e CTA em um único bloco.";
  assert.equal(await processMessage(mensagem, config, f.port), "repetir");
  assert.equal(f.envios.length, 0);
  f.port.generate = gerar;
  assert.equal(await processMessage(mensagem, config, f.port), "enviada");
  assert.equal(f.envios.length, 3);
});
