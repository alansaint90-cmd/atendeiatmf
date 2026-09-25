import type { AgentConfig } from "./config";
import type { IncomingMessage } from "./message";
import { digest } from "./message";
import { ProviderError, type Turn } from "./providers";
import { extrairNomeInformado, instrucoesComNome, respostaComNome } from "./nome";

export interface DeliveryState { status: "gerando" | "gerada" | "enviando" | "enviada" | "incerta" | "falhou"; attempts: number; reply?: string; transcript?: string; code?: string; configHash?: string; providerId?: string }
export interface ProcessingPort {
  read(): Promise<DeliveryState | null>;
  write(state: DeliveryState): Promise<void>;
  history(): Promise<Turn[]>;
  contactName?(): Promise<string | null>;
  rememberName?(name: string): Promise<void>;
  complete(state: DeliveryState, turns: Turn[]): Promise<void>;
  enabled(): Promise<boolean>;
  transcribe?(config: AgentConfig, message: IncomingMessage): Promise<string>;
  generate(config: AgentConfig, history: Turn[], text: string): Promise<string>;
  send(config: AgentConfig, number: string, text: string): Promise<string>;
}

export async function processMessage(message: IncomingMessage, config: AgentConfig, port: ProcessingPort): Promise<string> {
  let state = await port.read();
  if (state?.status === "enviada" || state?.status === "incerta" || state?.status === "falhou") return state.status;
  // Não repetir um envio cujo resultado se perdeu durante queda ou timeout.
  if (state?.status === "enviando") {
    await port.write({ ...state, status: "incerta", code: "envio_interrompido" });
    return "incerta";
  }
  if (!await port.enabled()) return "pausada";
  const configHash = digest(JSON.stringify(config));
  if (state?.configHash !== configHash) state = null;
  if ((state?.attempts ?? 0) >= 3 && !state?.reply) {
    await port.write({ ...state!, status: "falhou", code: "limite_tentativas" });
    return "falhou";
  }
  if (!state?.reply) {
    const attempts = (state?.attempts ?? 0) + 1;
    let transcript = state?.transcript;
    await port.write({ status: "gerando", attempts, configHash, transcript });
    let reply: string;
    try {
      if (message.audio && !transcript) {
        if (!port.transcribe) throw new ProviderError("audio_transcricao_indisponivel");
        const candidate = (await port.transcribe(config, message)).trim();
        if (!candidate || candidate.length > 12000) throw new ProviderError("audio_transcricao_invalida");
        transcript = candidate;
        await port.write({ status: "gerando", attempts, configHash, transcript });
        if (!await port.enabled()) return "pausada";
      }
      const historico = await port.history();
      const informado = extrairNomeInformado(transcript ?? message.text, historico);
      const nome = informado ?? await port.contactName?.() ?? null;
      if (informado && port.rememberName) await port.rememberName(informado);
      const instrucoes = instrucoesComNome(config.AI_SYSTEM_PROMPT, nome, historico.length === 0);
      const gerada = await port.generate({ ...config, AI_SYSTEM_PROMPT: instrucoes }, historico, transcript ?? message.text);
      reply = respostaComNome(gerada, nome);
    }
    catch (error) {
      const code = error instanceof ProviderError ? error.code : "geracao_falhou";
      await port.write({ status: attempts >= 3 ? "falhou" : "gerando", attempts, code, configHash, transcript });
      return attempts >= 3 ? "falhou" : "repetir";
    }
    state = { status: "gerada", attempts, reply, configHash, transcript };
    await port.write(state);
  }
  if (!await port.enabled()) return "pausada";
  if (/\[(?:NOME|NOME DO CLIENTE)\]|\{NOME\}/iu.test(state.reply!)) {
    state = { ...state, reply: respostaComNome(state.reply!, await port.contactName?.() ?? null) };
    await port.write(state);
  }
  await port.write({ ...state, status: "enviando" });
  try { state.providerId = await port.send(config, message.number, state.reply!); }
  catch (error) {
    await port.write({ ...state, status: "incerta", code: error instanceof ProviderError ? error.code : "envio_incerto" });
    return "incerta";
  }
  // Estado e histórico são confirmados juntos. Se falhar, permanece "enviando".
  await port.complete({ ...state, status: "enviada" }, [
    { role: "user", content: state.transcript ?? message.text }, { role: "assistant", content: state.reply! },
  ]);
  return "enviada";
}
