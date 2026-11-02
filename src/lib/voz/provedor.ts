import { z } from "zod";
import type { AgentConfig } from "../agent/config";
import { ProviderError } from "../agent/providers";
import { validarOggOpus } from "./codec";

type Config = Pick<AgentConfig, "EVOLUTION_API_URL" | "EVOLUTION_API_KEY" | "EVOLUTION_INSTANCE_NAME">;
export class EnvioVozRecusado extends ProviderError {}
async function jsonCurto(resposta: Response): Promise<unknown> {
  const reader = resposta.body?.getReader();
  if (!reader) throw new ProviderError("voz_provedor_resposta_invalida");
  let tamanho = 0;
  const partes: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > 128 * 1024) throw new ProviderError("voz_provedor_resposta_excedida");
      partes.push(value);
    }
    return JSON.parse(Buffer.concat(partes).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Confirma versão e canal na instalação configurada antes de qualquer síntese paga. */
export async function verificarProvedorVoz(config: Config, request = fetch): Promise<void> {
  if (config.EVOLUTION_INSTANCE_NAME !== "levaelava") throw new ProviderError("voz_instancia_nao_permitida");
  const base = config.EVOLUTION_API_URL.replace(/\/$/u, "");
  try {
    const servidor = await request(base, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!servidor.ok) throw new ProviderError("voz_versao_indisponivel");
    const versao = z.object({ version: z.literal("2.3.7") }).safeParse(await jsonCurto(servidor));
    if (!versao.success) throw new ProviderError("voz_versao_nao_homologada");
    const instancias = await request(`${base}/instance/fetchInstances?instanceName=${encodeURIComponent(config.EVOLUTION_INSTANCE_NAME)}`, {
      redirect: "error", signal: AbortSignal.timeout(5000), headers: { apikey: config.EVOLUTION_API_KEY },
    });
    if (!instancias.ok) throw new ProviderError("voz_canal_indisponivel");
    const canais = z.array(z.object({ name: z.string(), integration: z.string() })).max(100).safeParse(await jsonCurto(instancias));
    if (!canais.success || !canais.data.some(canal => canal.name === config.EVOLUTION_INSTANCE_NAME && canal.integration === "WHATSAPP-BAILEYS")) {
      throw new ProviderError("voz_ptt_nao_suportado");
    }
  } catch (erro) { throw erro instanceof ProviderError ? erro : new ProviderError("voz_verificacao_falhou"); }
}

export async function enviarVoz(config: Config, numero: string, audio: Buffer, request = fetch): Promise<string> {
  if (config.EVOLUTION_INSTANCE_NAME !== "levaelava" || !/^[1-9]\d{6,14}$/u.test(numero)) throw new EnvioVozRecusado("voz_envio_invalido");
  validarOggOpus(audio);
  let resposta: Response;
  try {
    resposta = await request(`${config.EVOLUTION_API_URL.replace(/\/$/u, "")}/message/sendWhatsAppAudio/${encodeURIComponent(config.EVOLUTION_INSTANCE_NAME)}`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { apikey: config.EVOLUTION_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ number: numero, audio: audio.toString("base64"), encoding: false }),
    });
  } catch { throw new ProviderError("voz_envio_incerto"); }
  if (!resposta.ok) {
    // 400 também pode esconder falha após envio no canal; conservar como incerto.
    if ([401, 403, 404, 413, 415, 422].includes(resposta.status)) throw new EnvioVozRecusado(`voz_envio_recusado_${resposta.status}`);
    throw new ProviderError(`voz_envio_incerto_${resposta.status}`);
  }
  const confirmado = z.object({ key: z.object({ id: z.string().min(1).max(200) }) }).safeParse(await jsonCurto(resposta).catch(() => null));
  if (!confirmado.success) throw new ProviderError("voz_confirmacao_ausente");
  return confirmado.data.key.id;
}
