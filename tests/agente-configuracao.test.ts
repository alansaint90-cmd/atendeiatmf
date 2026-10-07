import test from "node:test";
import assert from "node:assert/strict";
import { configurarAgente } from "../src/lib/agent/config";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { processMessage, type DeliveryState, type ProcessingPort } from "../src/lib/agent/processor";
import { generateReply, type Turn } from "../src/lib/agent/providers";
import { incomingMessage } from "../src/lib/agent/message";
import { avisoParaWellington } from "../src/lib/agent/transferencia";

const base = { AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "gpt-4.1-mini",
  EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "chip-a", REDIS_URL: "redis://localhost:6379" };
const bot = { ...chatbotExample, persona: "Derek", gender: "Masculino" as const, context: "Atenda como Derek.", transferNotice: "Vou encaminhar para nossa equipe.", destination: "Suporte" as const };
const config = configurarAgente(base, bot).data!;
const mensagem = { identity: "id", conversation: "conversa", number: "5511999999999", text: "Qual seu nome?", timestamp: Date.now() / 1000 };
test("pedido previsto no prompt precede fallback e transferência genérica", async () => {
  const configuracao = configurarAgente(base, { ...bot, context: 'Se pedir para falar com Wellington, pergunte o motivo do contato antes de encaminhar.', fallback: 'Não tenho essa resposta.' }).data!;
  assert.match(configuracao.AI_SYSTEM_PROMPT, /Antes do fallback ou da transferência/);
  assert.match(configuracao.AI_SYSTEM_PROMPT, /Siga primeiro o procedimento específico do prompt/);
  const f = portas();
  f.port.generate = async (atual, historico, texto) => generateReply(atual, historico, texto, async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    assert.match(corpo.instructions, /pergunte o motivo do contato antes de encaminhar/);
    assert.match(corpo.tools[0].description, /Siga primeiro o procedimento específico do prompt/);
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Aaron, qual é o motivo do contato?" }] }] });
  });
  assert.equal(await processMessage({ ...mensagem, text: "Como funciona o atendimento de Wellington?" }, configuracao, f.port), "enviada");
  assert.deepEqual(f.destinos, []);
  assert.deepEqual(f.saidas, ["Aaron, qual é o motivo do contato?"]);
});
function portas() {
  let estado: DeliveryState | null = null;
  const historico: Turn[] = [{ role: "user", content: "Quero informações" }, { role: "assistant", content: "Eu sou a Thaís." }];
  const saidas: string[] = [];
  const destinos: string[] = [];
  const port: ProcessingPort = { read: async () => estado, write: async valor => { estado = valor; },
    history: async () => historico, enabled: async () => true, contactName: async () => "Allan",
    generate: async () => "Eu sou Derek.", transferir: async destino => { destinos.push(destino); },
    send: async (_config, _numero, texto) => { saidas.push(texto); return "saida"; },
    complete: async (valor, turnos) => { estado = valor; historico.push(...turnos); } };
  return { port, historico, saidas, destinos, estado: () => estado, nova: () => { estado = null; } };
}

test("revisa a transferência indevida sobre Wellington e responde com o prompt salvo", async () => {
  for (const pergunta of ["Quem é o Welington?", "Como funciona o atendimento de Wellington?", "Quero saber sobre Wellington Junior"]) {
    const configuracao = configurarAgente(base, { ...bot, context: "Wellington Junior é o profissional responsável pelo atendimento individual. Se o cliente pedir para falar com ele, pergunte o motivo do contato antes de encaminhar." }).data!;
    const f = portas();
    let chamadas = 0;
    f.port.generate = async (atual, historico, texto) => generateReply(atual, historico, texto, async (_url, init) => {
      const corpo = JSON.parse(String(init?.body));
      chamadas++;
      if (chamadas === 1) return Response.json({ status: "completed", output: [{ type: "function_call", name: "transferir_para_humano", arguments: "{}" }] });
      assert.equal(corpo.tools, undefined);
      assert.match(corpo.instructions, /Wellington Junior é o profissional responsável/);
      assert.match(corpo.instructions, /variações de grafia/);
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ acao: "responder", resposta: "Aaron, qual é o motivo do contato com Wellington?", trecho_prompt: "" }) }] }] });
    });
    assert.equal(await processMessage({ ...mensagem, text: pergunta }, configuracao, f.port), "enviada");
    assert.equal(chamadas, 2);
    assert.deepEqual(f.destinos, []);
    assert.deepEqual(f.saidas, ["Aaron, qual é o motivo do contato com Wellington?"]);
  }
});

test("pedido direto de Wellington registra a transferência e envia aviso mesmo após a própria pausa", async () => {
  const atual = configurarAgente(base, { ...bot, context: "Wellington Junior é responsável pelo atendimento individual." }).data!;
  assert.equal(avisoParaWellington(config, "Quero falar com Wellington"), null);
  assert.equal(avisoParaWellington(atual, "Não quero falar com Wellington"), null);
  assert.equal(avisoParaWellington(atual, "Quem é Wellington?"), null);
  assert.equal(avisoParaWellington({ ...atual, atendimento: { ...atual.atendimento!, transferHuman: false } }, "Quero falar com Wellington"), null);
  for (const texto of ["Quero falar com Welington", "Preciso falar com o Wellington"]) {
    const f = portas();
    let pausado = false;
    f.port.enabled = async () => !pausado;
    f.port.generate = async () => { throw new Error("Pedido direto não depende do modelo"); };
    f.port.transferir = async destino => { f.destinos.push(destino); pausado = true; };
    assert.equal(await processMessage({ ...mensagem, text: texto }, atual, f.port), "enviada");
    assert.deepEqual(f.destinos, ["Suporte"]);
    assert.deepEqual(f.saidas, ["Vou transferir seu atendimento para o Wellington. Aguarde alguns instantes, por favor."]);
    assert.equal(f.estado()?.transferencia, true);
    await processMessage({ ...mensagem, text: texto }, atual, f.port);
    assert.equal(f.saidas.length, 1);
  }
});

test("persona e tom atuais prevalecem; roteiro antigo fica fora do contexto sem apagar histórico", async () => {
  const f = portas();
  f.port.generate = async (atual, historico) => {
    assert.match(atual.AI_SYSTEM_PROMPT, /Seu nome é Derek/);
    assert.match(atual.AI_SYSTEM_PROMPT, /Vendedor, Direto ao ponto, Profissional/);
    assert.deepEqual(historico, [{ role: "user", content: "Quero informações" }]);
    return "Eu sou Derek.";
  };
  assert.equal(await processMessage(mensagem, config, f.port), "enviada");
  assert.ok(f.historico.some(turno => turno.content === "Eu sou a Thaís."));
  f.nova();
  f.port.generate = async (_atual, historico) => {
    assert.ok(historico.some(turno => turno.content === "Eu sou Derek.")); return "Olá, Allan.";
  };
  await processMessage(mensagem, config, f.port);
  f.nova();
  const novaConfig = configurarAgente(base, { ...bot, persona: "Ana", context: "Atenda como Ana." }).data!;
  f.port.generate = async (atual, historico) => {
    assert.match(atual.AI_SYSTEM_PROMPT, /Seu nome é Ana/);
    assert.ok(historico.every(turno => turno.role === "user")); return "Eu sou Ana.";
  };
  await processMessage(mensagem, novaConfig, f.port);
});

test("transferência usa aviso literal e destino cadastrado, sem nome ou saudação acrescentados", async () => {
  const f = portas(); f.port.generate = async () => ({ transferir: true });
  await processMessage(mensagem, config, f.port);
  assert.deepEqual(f.destinos, ["Suporte"]);
  assert.deepEqual(f.saidas, [bot.transferNotice]);
  assert.equal(f.estado()?.transferencia, true);
  await processMessage(mensagem, config, f.port);
  assert.equal(f.saidas.length, 1);
});

test("transferência desligada ou falha no encaminhamento nunca envia confirmação falsa", async () => {
  const f = portas(); f.port.generate = async () => ({ transferir: true });
  const desligada = configurarAgente(base, { ...bot, transferHuman: false }).data!;
  assert.equal(await processMessage(mensagem, desligada, f.port), "repetir");
  assert.equal(f.saidas.length, 0); assert.equal(f.destinos.length, 0);
  f.nova(); f.port.transferir = async () => { throw new Error("Falha simulada"); };
  await assert.rejects(processMessage(mensagem, config, f.port));
  assert.equal(f.saidas.length, 0);
  assert.equal(await processMessage(mensagem, config, f.port), "incerta");
});

test("imagens transferem somente quando habilitadas e dispensam geração", async () => {
  const evento = { event: "messages.upsert" as const, instance: "chip-a", data: { key: { id: "imagem", fromMe: false,
    remoteJid: "5511999999999@s.whatsapp.net" }, messageTimestamp: Math.floor(Date.now() / 1000), message: { imageMessage: {} } } };
  assert.equal(incomingMessage(evento, "chip-a"), null);
  const midia = incomingMessage(evento, "chip-a", Date.now(), true)!;
  const f = portas(); f.port.generate = async () => { throw new Error("Não gerar para imagem"); };
  const configuracao = configurarAgente(base, { ...bot, transferMedia: true, transferHuman: false }).data!;
  assert.equal(await processMessage(midia, configuracao, f.port), "enviada");
  assert.deepEqual(f.destinos, ["Suporte"]);
});

test("provedor oferece ação apenas se habilitada e não envia metadados internos no histórico", async () => {
  const request: typeof fetch = async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    if (!corpo.tools) return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ acao: "transferir", resposta: "", trecho_prompt: "quando o cliente insistir em falar diretamente com uma pessoa" }) }] }] });
    assert.equal(corpo.tools[0].name, "transferir_para_humano");
    assert.equal(corpo.tools[0].strict, true);
    assert.equal(corpo.input[0].revisao, undefined);
    return Response.json({ status: "completed", output: [{ type: "function_call", name: "transferir_para_humano", arguments: "{}" }] });
  };
  assert.deepEqual(await generateReply(config, [{ role: "user", content: "Olá", revisao: "interna" }], "Quero um atendente", request), { transferir: true });
  const desativada = configurarAgente(base, { ...bot, transferHuman: false }).data!;
  await assert.rejects(generateReply(desativada, [], "Oi", async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).tools, undefined);
    return Response.json({ status: "completed", output: [{ type: "function_call", name: "transferir_para_humano", arguments: "{}" }] });
  }), /openai_acao_invalida/);
});

test("revisão sem fundamento no prompt não autoriza encaminhar e usa o mesmo prazo da geração", async () => {
  let sinal: AbortSignal | null | undefined;
  let chamadas = 0;
  await assert.rejects(generateReply(config, [], "Quero falar com Wellington", async (_url, init) => {
    chamadas++;
    if (chamadas === 1) {
      sinal = init?.signal;
      return Response.json({ status: "completed", output: [{ type: "function_call", name: "transferir_para_humano", arguments: "{}" }] });
    }
    assert.equal(init?.signal, sinal);
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ acao: "transferir", resposta: "", trecho_prompt: "Orientação inventada para encaminhar qualquer pessoa." }) }] }] });
  }), /openai_transferencia_sem_fundamento/);
});
