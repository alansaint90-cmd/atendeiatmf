import test from "node:test";
import assert from "node:assert/strict";
import { processMessage, type ProcessingPort, type DeliveryState } from "../src/lib/agent/processor";
import type { AgentConfig } from "../src/lib/agent/config";
import { ProviderError } from "../src/lib/agent/providers";
import { EnvioVozRecusado } from "../src/lib/voz/provedor";
import { avisoVozIa, avisoVozLegado, vozDesativada, numeroLiberadoParaVoz, type EstadoAvisoVoz } from "../src/lib/voz/configuracao";

const config: AgentConfig = { AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
  EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "levaelava",
  REDIS_URL: "redis://localhost:6379", AI_SYSTEM_PROMPT: "Atenda com as regras do painel.",
  voz: { ...vozDesativada, habilitada: true, homologada: true } };
const mensagem = { identity: "evento-voz", conversation: "cliente-voz", number: "5511999999999", timestamp: 1700000000,
  text: "", audio: { id: "audio-entrada" } };
const resposta = "Olá! Sou da Leva e Lava. Como posso ajudar?";
function fixture() {
  let estado: DeliveryState | null = null;
  let geracoes = 0; let sinteses = 0;
  const envios: string[] = []; const ids: string[] = [];
  const bytes = Buffer.from("audio-simulado");
  const port: ProcessingPort = { read: async () => estado, write: async valor => { estado = structuredClone(valor); },
    history: async () => [{ role: "user", content: "Meu nome é Allan" }], enabled: async () => true,
    generate: async () => { geracoes++; return resposta; }, transcribe: async () => "Como funciona a lavanderia?",
    send: async (_config, _numero, texto) => { envios.push(texto); return `texto-${envios.length}`; },
    voiceEnabled: () => true,
    prepareVoice: async (_config, texto) => { assert.equal(texto, resposta); sinteses++; return bytes; },
    sendVoice: async (_config, numero, audio) => { assert.equal(numero, mensagem.number); assert.equal(audio.toString(), "audio-simulado"); envios.push("voz"); return "voz-confirmada"; },
    registrarParte: async id => { ids.push(id); },
    complete: async (valor, historico) => { estado = valor; assert.equal(historico[1].content, valor.reply); },
  };
  const executar = async (atual = config, entrada = mensagem) => {
    let resultado = "repetir";
    for (let i = 0; i < 12 && resultado === "repetir"; i++) resultado = await processMessage(entrada, atual, port);
    return resultado;
  };
  return { port, envios, ids, bytes, executar, estado: () => estado, geracoes: () => geracoes, sinteses: () => sinteses };
}
test("áudio recebido gera texto uma vez, divulga IA e envia voz com checkpoint e confirmação separados", async () => {
  const f = fixture();
  assert.equal(await processMessage(mensagem, config, f.port), "repetir");
  assert.equal(f.geracoes(), 1); assert.equal(f.sinteses(), 0); assert.deepEqual(f.envios, []);
  assert.equal(await f.executar(), "enviada");
  assert.deepEqual(f.envios, [avisoVozIa, "voz"]);
  assert.deepEqual(f.ids, ["texto-1", "voz-confirmada"]);
  assert.equal(f.estado()?.saidasVoz?.[1].geracao, "pronta");
  assert.equal(f.estado()?.saidasVoz?.[1].envio, "aceito");
  assert.equal(f.estado()?.reply, resposta); assert.equal(f.bytes.every(valor => valor === 0), true);
  await f.executar(); assert.equal(f.envios.length, 2); assert.equal(f.sinteses(), 1);
});

test("identifica voz uma vez na conversa e mantém os próximos áudios sem balão repetido", async () => {
  let aviso: EstadoAvisoVoz = "pendente";
  for (let indice = 0; indice < 2; indice++) {
    const f = fixture();
    f.port.estadoAvisoVoz = async () => aviso;
    f.port.reservarAvisoVoz = async () => { assert.equal(aviso, "pendente"); aviso = "reservado"; return true; };
    f.port.confirmarAvisoVoz = async id => { assert.equal(id, "texto-1"); aviso = "confirmado"; };
    assert.equal(await f.executar(), "enviada");
    assert.deepEqual(f.envios, indice === 0 ? [avisoVozIa, "voz"] : ["voz"]);
    assert.equal(f.sinteses(), 1);
  }
});

test("aviso legado confirmado no histórico evita novo aviso; fala do cliente não comprova divulgação", async () => {
  for (const role of ["assistant", "user"] as const) {
    const f = fixture(); let confirmado = false;
    f.port.history = async () => [{ role, content: avisoVozLegado }];
    f.port.confirmarAvisoVoz = async id => { assert.equal(id, "historico"); confirmado = true; };
    if (role === "user") f.port.confirmarAvisoVoz = undefined;
    assert.equal(await f.executar(), "enviada");
    assert.equal(confirmado, role === "assistant");
    assert.deepEqual(f.envios, role === "assistant" ? ["voz"] : [avisoVozIa, "voz"]);
  }
});

test("envio incerto do primeiro aviso não repete identificação nem libera voz na próxima mensagem", async () => {
  let aviso: EstadoAvisoVoz = "pendente";
  const f = fixture();
  f.port.estadoAvisoVoz = async () => aviso;
  f.port.reservarAvisoVoz = async () => { aviso = "reservado"; return true; };
  f.port.send = async () => { throw new ProviderError("envio_incerto"); };
  assert.equal(await f.executar(), "incerta");
  const proxima = fixture(); proxima.port.estadoAvisoVoz = async () => aviso;
  assert.equal(await proxima.executar(), "enviada");
  assert.deepEqual(proxima.envios, [resposta]); assert.equal(proxima.sinteses(), 0);
});
test("desligada, sem liberação do servidor, mensagem de texto e outro chip mantêm atendimento em texto", async () => {
  for (const caso of ["desligada", "servidor", "texto", "outro"]) {
    const f = fixture(); const atual = structuredClone(config);
    if (caso === "desligada") atual.voz!.habilitada = false;
    if (caso === "servidor") f.port.voiceEnabled = () => false;
    if (caso === "outro") atual.EVOLUTION_INSTANCE_NAME = "taistmf";
    const entrada = caso === "texto" ? { ...mensagem, audio: undefined, text: "Como funciona?" } : mensagem;
    assert.equal(await f.executar(atual, entrada as typeof mensagem), "enviada");
    assert.deepEqual(f.envios, [resposta]); assert.equal(f.sinteses(), 0);
  }
});

test("lista de teste libera somente telefone exato e mantém demais clientes em texto", async () => {
  assert.equal(numeroLiberadoParaVoz(mensagem.number, undefined), true);
  for (const lista of ["", " ", "invalido", `${mensagem.number},invalido`, `${mensagem.number},`, "5511888888888"]) {
    assert.equal(numeroLiberadoParaVoz(mensagem.number, lista), false);
  }
  assert.equal(numeroLiberadoParaVoz(mensagem.number, `5511888888888, ${mensagem.number}`), true);
  for (const autorizado of [true, false]) {
    const f = fixture();
    f.port.voiceEnabled = () => numeroLiberadoParaVoz(mensagem.number, autorizado ? mensagem.number : "5511888888888");
    assert.equal(await f.executar(), "enviada");
    assert.equal(f.sinteses(), autorizado ? 1 : 0);
    assert.deepEqual(f.envios, autorizado ? [avisoVozIa, "voz"] : [resposta]);
  }
});

test("revogar telefone entre balões evita síntese paga e usa texto uma vez", async () => {
  const f = fixture();
  assert.equal(await processMessage(mensagem, config, f.port), "repetir");
  assert.equal(await processMessage(mensagem, config, f.port), "repetir");
  f.port.voiceEnabled = () => false;
  assert.equal(await f.executar(), "enviada");
  assert.equal(f.sinteses(), 0);
  assert.deepEqual(f.envios, [avisoVozIa, resposta]);
});
test("falha na síntese usa o texto salvo uma vez, sem gerar outra resposta comercial", async () => {
  const f = fixture(); f.port.prepareVoice = async () => { throw new ProviderError("voz_realtime_timeout"); };
  assert.equal(await f.executar(), "enviada");
  assert.deepEqual(f.envios, [avisoVozIa, resposta]); assert.equal(f.geracoes(), 1);
  assert.equal(f.estado()?.saidasVoz?.[1].geracao, "texto_alternativo");
  assert.equal(f.estado()?.code, "voz_realtime_timeout");
});
test("rejeição confirmada de voz permite texto; timeout ou falta de confirmação não duplicam", async () => {
  const recusada = fixture(); recusada.port.sendVoice = async () => { throw new EnvioVozRecusado("voz_envio_recusado_415"); };
  assert.equal(await recusada.executar(), "enviada");
  assert.deepEqual(recusada.envios, [avisoVozIa, resposta]);
  for (const codigo of ["voz_envio_incerto", "voz_confirmacao_ausente"]) {
    const f = fixture(); f.port.sendVoice = async () => { f.envios.push("tentativa-voz"); throw new ProviderError(codigo); };
    assert.equal(await f.executar(), "incerta"); await f.executar();
    assert.deepEqual(f.envios, [avisoVozIa, "tentativa-voz"]);
    assert.equal(f.estado()?.saidasVoz?.[1].envio, "incerto");
  }
});
test("queda durante envio não repete; queda durante síntese usa alternativa sem nova chamada paga", async () => {
  for (const durante of ["enviando", "gerando"] as const) {
    const f = fixture();
    await processMessage(mensagem, config, f.port);
    await processMessage(mensagem, config, f.port); // Aviso confirmado.
    const estado = f.estado()!;
    estado.status = durante === "enviando" ? "enviando" : "gerada";
    estado.saidasVoz![1].geracao = "gerando";
    await f.port.write(estado);
    assert.equal(await f.executar(), durante === "enviando" ? "incerta" : "enviada");
    assert.equal(f.sinteses(), 0);
    assert.deepEqual(f.envios, durante === "enviando" ? [avisoVozIa] : [avisoVozIa, resposta]);
  }
});
test("pausa antes do envio descarta áudio e preserva checkpoints; texto copiável permanece em texto", async () => {
  const f = fixture();
  f.port.prepareVoice = async () => { f.port.enabled = async () => false; return f.bytes; };
  assert.equal(await f.executar(), "pausada");
  assert.deepEqual(f.envios, [avisoVozIa]); assert.ok(f.bytes.every(valor => valor === 0));
  f.port.enabled = async () => true;
  assert.equal(await f.executar(), "enviada"); assert.deepEqual(f.envios, [avisoVozIa, resposta]);
  for (const texto of ["Custa R$ 13,90.", "Veja https://maps.app.goo.gl/teste", "Avenida Praia de Itapuã.", "Passo a passo: selecione a máquina."]) {
    const textoFixo = fixture(); textoFixo.port.generate = async () => texto;
    assert.equal(await textoFixo.executar(), "enviada"); assert.deepEqual(textoFixo.envios, [texto]); assert.equal(textoFixo.sinteses(), 0);
  }
});

test("sequência mista envia voz e complemento copiável sem duplicar os textos narrados", async () => {
  const f = fixture(); const narrados: string[] = [];
  const maps = "https://maps.app.goo.gl/UnidadeTeste";
  const mensagens = ["Olá! Somos a Leva e Lava.", "A promoção custa R$ 13,90.", `Endereço cadastrado.\n\n${maps}`, "Pode contar comigo!"];
  const atual: AgentConfig = { ...config, contextoPrincipal: maps, flows: [{ name: "Campanha", description: "Siga os textos cadastrados.",
    triggers: ["Como funciona a lavanderia?"], sequencia: { chave: "campanha-teste", instancia: "levaelava", mensagens } }] };
  f.port.reservarFluxo = async () => true;
  f.port.prepareVoice = async (_config, texto) => { narrados.push(texto); return Buffer.from("audio-simulado"); };
  let vozes = 0;
  f.port.sendVoice = async () => { f.envios.push("voz"); return `voz-${++vozes}`; };
  assert.equal(await f.executar(atual), "enviada");
  assert.deepEqual(narrados, [mensagens[0], mensagens[3]]);
  assert.deepEqual(f.envios, [avisoVozIa, "voz", mensagens[1], mensagens[2], "voz"]);
  assert.equal(f.estado()?.reply, mensagens.join("\n\n"));
});

test("falha ao registrar ID após aceitação não gera alternativa textual nem repete voz", async () => {
  const f = fixture();
  f.port.registrarParte = async id => { if (id === "voz-confirmada") throw new EnvioVozRecusado("Falha simulada no registro"); };
  assert.equal(await f.executar(), "incerta");
  await f.executar();
  assert.deepEqual(f.envios, [avisoVozIa, "voz"]);
  assert.equal(f.estado()?.providerId, "voz-confirmada");
  assert.equal(f.estado()?.saidasVoz?.[1].envio, "aceito");
});

test("desligar a liberação durante a síntese usa texto e apaga o áudio preparado", async () => {
  const f = fixture();
  f.port.prepareVoice = async () => { f.port.voiceEnabled = () => false; return f.bytes; };
  assert.equal(await f.executar(), "enviada");
  assert.deepEqual(f.envios, [avisoVozIa, resposta]);
  assert.ok(f.bytes.every(valor => valor === 0));
});
