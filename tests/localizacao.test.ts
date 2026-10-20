import test from "node:test";
import assert from "node:assert/strict";
import { processMessage, type DeliveryState, type ProcessingPort } from "../src/lib/agent/processor";
import type { AgentConfig } from "../src/lib/agent/config";
import { filtrarLocalizacao, pediuLocalizacao } from "../src/lib/agent/localizacao";
import { messageStore } from "../src/lib/agent/store";
import { digest } from "../src/lib/agent/message";
import type Redis from "ioredis";

const maps = "https://maps.app.goo.gl/UnidadeTeste";
const config: AgentConfig = { AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
  EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "levaelava",
  REDIS_URL: "redis://localhost:6379", AI_SYSTEM_PROMPT: "Responda conforme o cadastro.", contextoPrincipal: maps };
const mensagem = { identity: "evento", conversation: "cliente", number: "5511999999999", timestamp: 1700000000, text: "Qual o horário?" };
function fixture() {
  let estado: DeliveryState | null = null;
  const envios: string[] = [];
  const port: ProcessingPort = {
    read: async () => estado, write: async valor => { estado = structuredClone(valor); },
    history: async () => [{ role: "assistant", content: `Nossa localização: ${maps}`, revisao: "antiga" }],
    enabled: async () => true, generate: async () => `Funcionamos 24 horas.\n\n📍 ${maps}\n\nQuer que eu envie a localização?`,
    send: async (_config, _numero, texto) => { envios.push(texto); return `id-${envios.length}`; },
    complete: async valor => { estado = valor; },
  };
  return { port, envios };
}
test("levaelava não repete Maps nem oferta mesmo com histórico de revisão antiga", async () => {
  const f = fixture();
  assert.equal(await processMessage(mensagem, config, f.port), "enviada");
  assert.deepEqual(f.envios, ["Funcionamos 24 horas."]);
});
test("pedido explícito permite reenviar Maps e outro chip preserva comportamento", async () => {
  for (const [atual, texto] of [[config, "Manda a localização de novo, por favor"], [{ ...config, EVOLUTION_INSTANCE_NAME: "taistmf" }, "Qual o horário?"]] as const) {
    const f = fixture();
    await processMessage({ ...mensagem, text: texto }, atual, f.port);
    assert.ok(f.envios[0].includes(maps));
  }
});

test("memória persistida funciona sem histórico e pedido por áudio permite reenvio", async () => {
  const f = fixture();
  f.port.history = async () => [];
  f.port.localizacaoEnviada = async () => true;
  await processMessage(mensagem, config, f.port);
  assert.ok(!f.envios.join("").includes(maps));
  const audio = fixture();
  audio.port.transcribe = async () => "Pode me enviar o endereço novamente?";
  await processMessage({ ...mensagem, audio: { id: "audio-teste" }, text: "" }, config, audio.port);
  assert.ok(audio.envios.join("").includes(maps));
});

test("promoção mantém primeiro Maps, remove oferta no CTA e omite endereço repetido", () => {
  const partes = ["Promoção da madrugada.", `Endereço e referências.\n\n📍 ${maps}`, "Quer aproveitar hoje? Posso te enviar a localização para facilitar sua visita!"];
  assert.deepEqual(filtrarLocalizacao(partes, false, "Quero saber da promoção"), [
    partes[0], partes[1], "Quer aproveitar hoje?",
  ]);
  assert.deepEqual(filtrarLocalizacao(partes, true, "Quero saber da promoção"), [partes[0], "Quer aproveitar hoje?"]);
  assert.deepEqual(filtrarLocalizacao(partes, true, "Manda a localização novamente"), [partes[0], partes[1], "Quer aproveitar hoje?"]);
});

test("não confunde menção ou recusa com pedido de localização", () => {
  for (const texto of ["Já recebi a localização", "Vocês enviaram o Maps", "O endereço que vocês passaram", "Não precisa mandar o Maps", "Não quero o endereço", "Qual o preço?", "Obrigado pelo endereço"]) {
    assert.equal(pediuLocalizacao(texto), false, texto);
  }
  for (const texto of ["Onde fica?", "Como chegar?", "Me passa o link do Maps", "Localização?", "Reenvia o endereço", "Não recebi o Maps, manda novamente"]) {
    assert.equal(pediuLocalizacao(texto), true, texto);
  }
});

test("reserva localização antes de enviar; erro e repetição do evento não duplicam", async () => {
  const f = fixture();
  f.port.history = async () => [{ role: "user", content: "Oi" }];
  let marcada = false;
  f.port.marcarLocalizacao = async () => { marcada = true; };
  f.port.send = async () => { assert.equal(marcada, true); throw new Error("Entrega incerta"); };
  assert.equal(await processMessage(mensagem, config, f.port), "incerta");
  f.port.send = async () => { assert.fail("Não deve repetir entrega incerta"); };
  assert.equal(await processMessage(mensagem, config, f.port), "incerta");
});

test("primeiro envio marca, nova mensagem sem histórico não repete e reenvio pedido funciona", async () => {
  let marcada = false;
  for (const [texto, esperado] of [["Quero saber da promoção", true], ["Qual o horário?", false], ["Me manda o Maps novamente", true]] as const) {
    const f = fixture();
    f.port.history = async () => [{ role: "user", content: "Oi" }];
    f.port.localizacaoEnviada = async () => marcada;
    f.port.marcarLocalizacao = async () => { marcada = true; };
    await processMessage({ ...mensagem, text: texto, identity: texto }, config, f.port);
    assert.equal(f.envios.join("").includes(maps), esperado);
    assert.equal(marcada, true);
  }
});

test("marca persistente separa cliente e instância e grava sob a lease sem TTL", async () => {
  const dados = new Map<string, string>();
  const redis = {
    get: async (chave: string) => dados.get(chave) ?? null,
    eval: async (script: string, quantidade: number, lock: string, chave: string, token: string, valor: string) => {
      assert.match(script, /GET.*KEYS\[1\].*ARGV\[1\]/);
      assert.doesNotMatch(script, /'EX'|'PX'|EXPIRE/);
      assert.equal(quantidade, 2);
      assert.match(lock, /agent-lock$/);
      assert.equal(token, "posse-teste");
      dados.set(chave, valor); return 1;
    },
  } as unknown as Redis;
  const store = (instancia: string, cliente: string) => messageStore(redis, "posse-teste", {
    ...mensagem, conversation: digest(`${instancia}:${cliente}@s.whatsapp.net`),
  });
  await store("levaelava", "5511999999999").marcarLocalizacao();
  assert.equal(await store("levaelava", "5511999999999").localizacaoEnviada(), true);
  assert.equal(await store("levaelava", "5511888888888").localizacaoEnviada(), false);
  assert.equal(await store("taistmf", "5511999999999").localizacaoEnviada(), false);
});
