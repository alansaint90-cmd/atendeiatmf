import type { AgentConfig } from "../agent/config";
import { ProviderError } from "../agent/providers";
import { verificarProvedorVoz } from "./provedor";
import { narrarTexto } from "./realtime";
import { converterPcmParaOgg, verificarConversorVoz } from "./codec";

export async function prepararVoz(config: AgentConfig, texto: string): Promise<Buffer> {
  if (process.env.ATENDEIA_VOICE_ENABLED !== "true" || !config.voz?.habilitada || !config.voz.homologada
    || config.EVOLUTION_INSTANCE_NAME !== "levaelava") throw new ProviderError("voz_desativada");
  await verificarConversorVoz();
  await verificarProvedorVoz(config);
  const pcm = await narrarTexto(config.OPENAI_API_KEY, config.voz.voz, texto);
  try { return await converterPcmParaOgg(pcm); }
  finally { pcm.fill(0); }
}
