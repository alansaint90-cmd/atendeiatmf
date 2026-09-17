import type { AgentConfig } from "./config";
import type { IncomingMessage } from "./message";
import { digest } from "./message";
import { ProviderError, type Turn } from "./providers";

export interface DeliveryState { status: "gerando" | "gerada" | "enviando" | "enviada" | "incerta" | "falhou"; attempts: number; reply?: string; code?: string; configHash?: string; providerId?: string }
export interface ProcessingPort {
  read(): Promise<DeliveryState | null>;
  write(state: DeliveryState): Promise<void>;
  history(): Promise<Turn[]>;
  complete(state: DeliveryState, turns: Turn[]): Promise<void>;
  enabled(): Promise<boolean>;
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
    await port.write({ status: "gerando", attempts, configHash });
    let reply: string;
    try { reply = await port.generate(config, await port.history(), message.text); }
    catch (error) {
      const code = error instanceof ProviderError ? error.code : "geracao_falhou";
      await port.write({ status: attempts >= 3 ? "falhou" : "gerando", attempts, code, configHash });
      return attempts >= 3 ? "falhou" : "repetir";
    }
    state = { status: "gerada", attempts, reply, configHash };
    await port.write(state);
  }
  if (!await port.enabled()) return "pausada";
  await port.write({ ...state, status: "enviando" });
  try { state.providerId = await port.send(config, message.number, state.reply!); }
  catch (error) {
    await port.write({ ...state, status: "incerta", code: error instanceof ProviderError ? error.code : "envio_incerto" });
    return "incerta";
  }
  // Estado e histórico são confirmados juntos. Se falhar, permanece "enviando".
  await port.complete({ ...state, status: "enviada" }, [
    { role: "user", content: message.text }, { role: "assistant", content: state.reply! },
  ]);
  return "enviada";
}
