import { z } from "zod";
import { effectiveSettings } from "../src/lib/settings/repository";
import { settingsSchema } from "../src/lib/settings/schema";
import { instanciasConfiguradas } from "../src/lib/evolution/instancias";
import { vozes } from "../src/lib/voz/configuracao";
import { verificarConversorVoz, converterPcmParaOgg } from "../src/lib/voz/codec";
import { narrarTexto } from "../src/lib/voz/realtime";
import { enviarVoz, verificarProvedorVoz } from "../src/lib/voz/provedor";
import { sendReply, ProviderError } from "../src/lib/agent/providers";

async function main() {
  const args = process.argv.slice(2);
  const numero = args.find(arg => arg.startsWith("--numero-teste="))?.slice("--numero-teste=".length);
  const voz = args.find(arg => arg.startsWith("--voz="))?.slice("--voz=".length) ?? "marin";
  const autorizacao = z.strictObject({ sintese: z.literal(true), envio: z.literal(true),
    numero: z.string().regex(/^[1-9]\d{6,14}$/u), voz: z.enum(vozes) }).safeParse({
    sintese: args.includes("--autorizar-sintese-paga"), envio: args.includes("--autorizar-envio-teste"), numero, voz,
  });
  if (!autorizacao.success || process.env.VOZ_HOMOLOGACAO_ISOLADA !== "true"
    || process.env.ATENDEIA_WORKER_ENABLED === "true" || process.env.ATENDEIA_VOICE_ENABLED === "true") {
    throw new ProviderError("voz_homologacao_exige_ambiente_isolado_e_autorizacao_explicita");
  }
  const settings = await effectiveSettings();
  if (!instanciasConfiguradas(settings).includes("levaelava")) throw new ProviderError("voz_instancia_nao_configurada");
  const config = settingsSchema.pick({ OPENAI_API_KEY: true, EVOLUTION_API_URL: true,
    EVOLUTION_API_KEY: true, EVOLUTION_INSTANCE_NAME: true }).required().parse({
    OPENAI_API_KEY: settings.OPENAI_API_KEY, EVOLUTION_API_URL: settings.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: settings.EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME: "levaelava",
  });
  await verificarConversorVoz(); await verificarProvedorVoz(config);
  const pcm = await narrarTexto(config.OPENAI_API_KEY, autorizacao.data.voz, "Olá! Esta é uma voz gerada por inteligência artificial para o teste de pronúncia da Leva e Lava, em português brasileiro.");
  let audio: Buffer | undefined;
  try {
    audio = await converterPcmParaOgg(pcm);
    // Somente o número explicitamente autorizado. Sem retentativas, inclusive no aviso.
    await sendReply(config, autorizacao.data.numero, "Teste autorizado: a próxima mensagem é uma voz gerada por inteligência artificial.");
    await enviarVoz(config, autorizacao.data.numero, audio);
    console.info("Áudio de teste aceito pelo provedor. Confira pronúncia e reprodução no aparelho antes de homologar. Não comprova entrega.");
  } finally { pcm.fill(0); audio?.fill(0); }
}
void main().catch(erro => {
  console.error(erro instanceof ProviderError ? erro.code : "voz_homologacao_falhou");
  console.error("Não repita um envio incerto. Este comando é exclusivo de ambiente isolado e número de teste autorizado.");
  process.exitCode = 1;
});
