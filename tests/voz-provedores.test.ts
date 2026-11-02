import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import type WebSocket from "ws";
import { converterPcmParaOgg, maxPcm, verificarConversorVoz } from "../src/lib/voz/codec";
import { prepararVoz } from "../src/lib/voz/sintese";
import { spawnSync } from "node:child_process";
import { modeloVoz, narrarTexto, type AbrirSocket } from "../src/lib/voz/realtime";
import { enviarVoz, EnvioVozRecusado, verificarProvedorVoz } from "../src/lib/voz/provedor";
import { configuracaoVozSchema, textoParaFala, vozDesativada } from "../src/lib/voz/configuracao";

const config = { EVOLUTION_INSTANCE_NAME: "levaelava", EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste" };
const pcmTeste = () => {
  const bytes = Buffer.alloc(24000 * 2);
  for (let i = 0; i < 24000; i++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / 24000) * 4000), i * 2);
  return bytes;
};
const oggSimulado = () => {
  const bytes = Buffer.alloc(100); bytes.write("OggS"); bytes.write("OpusHead", 28); return bytes;
};
test("configuração começa desligada, exige modo/homologação e não aceita parâmetros arbitrários", () => {
  assert.equal(vozDesativada.habilitada, false);
  assert.equal(configuracaoVozSchema.safeParse({ ...vozDesativada, habilitada: true }).success, false);
  assert.equal(configuracaoVozSchema.safeParse({ ...vozDesativada, habilitada: true, homologada: true }).success, true);
  assert.equal(configuracaoVozSchema.safeParse({ ...vozDesativada, url: "https://example.invalid" }).success, false);
  assert.equal(textoParaFala("**Leva & Lava** 💙"), "Leva e Lava");
});
test("converte PCM real em Ogg/Opus reproduzível, mono, sem apenas renomear extensão", async () => {
  assert.ok(ffmpeg, "FFmpeg de testes precisa estar instalado");
  const executavel = ffmpeg;
  await verificarConversorVoz(executavel);
  const pcm = pcmTeste();
  const ogg = await converterPcmParaOgg(pcm, ffmpeg);
  assert.equal(ogg.toString("ascii", 0, 4), "OggS");
  assert.ok(ogg.includes(Buffer.from("OpusHead")));
  const cabecalho = ogg.indexOf(Buffer.from("OpusHead"));
  assert.equal(ogg[cabecalho + 9], 1); // Um canal no OpusHead.
  assert.equal(ogg.readUInt32LE(cabecalho + 12), 48000);
  const decodificado = await new Promise<Buffer>((resolve, reject) => {
    const processo = spawn(executavel, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ar", "24000", "-ac", "1", "pipe:1"],
      { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    const partes: Buffer[] = [];
    processo.on("error", reject); processo.stdout.on("data", (parte: Buffer) => partes.push(parte));
    processo.on("close", codigo => codigo === 0 ? resolve(Buffer.concat(partes)) : reject(new Error("Áudio não decodificável")));
    processo.stdin.end(ogg);
  });
  assert.ok(Math.abs(decodificado.length - pcm.length) < 5000);
  assert.ok(decodificado.some(valor => valor !== 0));
  await assert.rejects(converterPcmParaOgg(Buffer.alloc(maxPcm + 2), ffmpeg), /voz_duracao_invalida/);
  await assert.rejects(converterPcmParaOgg(pcm, "conversor-inexistente-teste"), /voz_conversao_falhou/);
});

test("flag ausente impede síntese antes de qualquer acesso ao provedor", async () => {
  const anterior = process.env.ATENDEIA_VOICE_ENABLED;
  delete process.env.ATENDEIA_VOICE_ENABLED;
  try {
    await assert.rejects(prepararVoz({ ...config, AI_ENABLED: "true", AI_SYSTEM_PROMPT: "Teste", OPENAI_API_KEY: "sk-test-only",
      OPENAI_MODEL: "modelo", REDIS_URL: "redis://localhost:6379", voz: { ...vozDesativada, habilitada: true, homologada: true } }, "Teste"), /voz_desativada/);
  } finally {
    if (anterior === undefined) delete process.env.ATENDEIA_VOICE_ENABLED; else process.env.ATENDEIA_VOICE_ENABLED = anterior;
  }
});

test("script de homologação sem flags explícitas recusa executar sem consultar credenciais", () => {
  const resultado = spawnSync(process.execPath, ["--import", "tsx", "scripts/homologar-voz.ts"], {
    encoding: "utf8", timeout: 15000, windowsHide: true,
    env: { ...process.env, VOZ_HOMOLOGACAO_ISOLADA: "false", DATABASE_URL: "", OPENAI_API_KEY: "", ATENDEIA_VOICE_ENABLED: "false" },
  });
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /voz_homologacao_exige_ambiente_isolado_e_autorizacao_explicita/);
});

function socketSimulado(transcrito: string, incompleta = false, exceder = false) {
  const socket = new EventEmitter() as EventEmitter & { send: (texto: string) => void; terminate: () => void };
  const enviados: Record<string, unknown>[] = [];
  let fechado = false;
  socket.terminate = () => { fechado = true; };
  socket.send = texto => {
    const evento = JSON.parse(texto) as Record<string, unknown>;
    enviados.push(evento);
    queueMicrotask(() => {
      if (evento.type === "session.update") socket.emit("message", JSON.stringify({ type: "session.updated" }));
      if (evento.type === "response.create") {
        socket.emit("message", JSON.stringify({ type: "response.created", response: { id: "resposta-teste" } }));
        socket.emit("message", JSON.stringify({ type: "response.output_audio.delta", response_id: "resposta-teste",
          delta: (exceder ? Buffer.alloc(maxPcm + 2) : pcmTeste()).toString("base64") }));
        socket.emit("message", JSON.stringify({ type: "response.done", response: { id: "resposta-teste", status: incompleta ? "incomplete" : "completed",
          output: [{ type: "message", role: "assistant", content: [{ type: "output_audio", transcript: transcrito }] }] } }));
      }
    });
  };
  const abrir: AbrirSocket = (url, chave) => {
    assert.equal(url, `wss://api.openai.com/v1/realtime?model=${modeloVoz}`); assert.equal(chave, "sk-test-only");
    queueMicrotask(() => socket.emit("message", JSON.stringify({ type: "session.created" })));
    return socket as unknown as WebSocket;
  };
  return { abrir, enviados, fechado: () => fechado };
}
test("Realtime narra texto literal em pt-BR, sem ferramentas, recolhe PCM e encerra sessão", async () => {
  const f = socketSimulado("Olá! Somos a Leva e Lava.");
  const pcm = await narrarTexto("sk-test-only", "marin", "Olá! Somos a Leva & Lava.", f.abrir);
  assert.equal(pcm.length, 48000); assert.equal(f.fechado(), true);
  const sessao = f.enviados[0].session as { instructions: string; tools: unknown[]; audio: { output: { voice: string } } };
  assert.match(sessao.instructions, /português brasileiro/); assert.match(sessao.instructions, /LE-va e LA-va/);
  assert.deepEqual(sessao.tools, []); assert.equal(sessao.audio.output.voice, "marin");
  const requisicao = f.enviados[1].response as { conversation: string; input: unknown[]; tools: unknown[] };
  assert.equal(requisicao.conversation, "none"); assert.deepEqual(requisicao.tools, []);
  assert.ok(JSON.stringify(requisicao.input).includes("Olá! Somos a Leva e Lava."));
});
test("divergência, resposta incompleta, excesso e timeout de síntese não passam para WhatsApp", async () => {
  for (const f of [socketSimulado("Ganhe uma lavagem grátis"), socketSimulado("Olá!", true), socketSimulado("Olá!", false, true)]) {
    await assert.rejects(narrarTexto("sk-test-only", "marin", "Olá!", f.abrir), /voz_/);
    assert.equal(f.fechado(), true);
  }
  const socket = new EventEmitter() as EventEmitter & { terminate: () => void };
  let encerrado = false; socket.terminate = () => { encerrado = true; };
  await assert.rejects(narrarTexto("sk-test-only", "marin", "Texto de teste", () => socket as unknown as WebSocket, 10), /voz_realtime_timeout/);
  assert.equal(encerrado, true);
});
test("consulta versão e canal reais; canal Cloud e versão desconhecida não permitem substituir PTT por anexo", async () => {
  const urls: string[] = [];
  const consultar = (versao: string, integration: string): typeof fetch => async (url, options) => {
    urls.push(String(url)); assert.equal(options?.redirect, "error");
    if (String(url).includes("fetchInstances")) {
      assert.deepEqual(options?.headers, { apikey: "teste" });
      return Response.json([{ name: "levaelava", integration }]);
    }
    return Response.json({ version: versao });
  };
  await verificarProvedorVoz(config, consultar("2.3.7", "WHATSAPP-BAILEYS"));
  assert.match(urls[1], /instanceName=levaelava/);
  await assert.rejects(verificarProvedorVoz(config, consultar("2.3.7", "WHATSAPP-BUSINESS")), /voz_ptt_nao_suportado/);
  await assert.rejects(verificarProvedorVoz(config, consultar("versao-futura", "WHATSAPP-BAILEYS")), /voz_versao_nao_homologada/);
});
test("envia Ogg/Opus por base64 no endpoint PTT, exige ID e distingue rejeição de envio incerto", async () => {
  const audio = oggSimulado();
  const id = await enviarVoz(config, "5511999999999", audio, async (url, options) => {
    assert.equal(url, "https://example.invalid/message/sendWhatsAppAudio/levaelava");
    assert.equal(options?.redirect, "error");
    assert.deepEqual(JSON.parse(String(options?.body)), { number: "5511999999999", audio: audio.toString("base64"), encoding: false });
    return Response.json({ key: { id: "id-confirmado" } });
  });
  assert.equal(id, "id-confirmado");
  await assert.rejects(enviarVoz(config, "5511999999999", audio, async () => new Response("", { status: 415 })), EnvioVozRecusado);
  await assert.rejects(enviarVoz(config, "5511999999999", audio, async () => { throw new Error("timeout com dados privados"); }), /voz_envio_incerto/);
  await assert.rejects(enviarVoz(config, "5511999999999", audio, async () => Response.json({})), /voz_confirmacao_ausente/);
  await assert.rejects(enviarVoz(config, "5511999999999", audio, async () => new Response("", { status: 500 })), erro => !(erro instanceof EnvioVozRecusado));
  await assert.rejects(enviarVoz(config, "5511999999999", audio, async () => new Response("", { status: 400 })), erro => !(erro instanceof EnvioVozRecusado));
});
