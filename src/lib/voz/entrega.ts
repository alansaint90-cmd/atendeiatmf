import type { DeliveryState, ProcessingPort } from "../agent/processor";
import type { AgentConfig } from "../agent/config";
import type { IncomingMessage } from "../agent/message";
import { ProviderError } from "../agent/providers";
import { EnvioVozRecusado } from "./provedor";
import { contemMaps } from "../agent/localizacao";

/** Uma saída por tick mantém síntese/envio dentro da lease existente de 120 segundos. */
export async function entregarSaidaVoz(state: DeliveryState, message: IncomingMessage, config: AgentConfig, port: ProcessingPort): Promise<{
  state: DeliveryState; resultado?: string;
}> {
  const indice = state.providerIds?.length ?? 0;
  const saidas = structuredClone(state.saidasVoz!);
  const saida = saidas[indice];
  if (!saida) return { state };
  if (!await port.enabled()) return { state, resultado: "pausada" };
  let audio: Buffer | undefined;
  const salvar = async (status: DeliveryState["status"] = "gerada") => {
    state = { ...state, status, saidasVoz: saidas };
    await port.write(state);
  };
  const codigo = (erro: unknown) => erro instanceof ProviderError ? erro.code : "voz_falhou";
  try {
    if (saida.tipo === "voz" && port.voiceEnabled?.() !== true) {
      saida.tipo = "texto"; saida.geracao = "texto_alternativo";
    }
    if (saida.tipo === "voz") {
      // Queda antes de começar o envio: usar o texto salvo em vez de refazer uma síntese paga.
      if (saida.geracao === "gerando" || saida.geracao === "pronta" || !port.prepareVoice || !port.sendVoice) {
        saida.tipo = "texto"; saida.geracao = "texto_alternativo";
        state = { ...state, code: "voz_geracao_interrompida" };
      } else {
        saida.geracao = "gerando"; await salvar();
        try {
          audio = await port.prepareVoice(config, saida.texto);
          saida.geracao = "pronta"; await salvar();
        } catch (erro) {
          saida.tipo = "texto"; saida.geracao = "texto_alternativo";
          state = { ...state, code: codigo(erro) }; await salvar();
        }
      }
    }
    if (!await port.enabled()) return { state, resultado: "pausada" };
    if (saida.tipo === "voz" && port.voiceEnabled?.() !== true) {
      saida.tipo = "texto"; saida.geracao = "texto_alternativo";
    }
    if (saida.avisoVoz && port.reservarAvisoVoz && !await port.reservarAvisoVoz()) {
      state = { ...state, code: "voz_aviso_reservado" }; await salvar("falhou");
      return { state, resultado: "falhou" };
    }
    saida.envio = "enviando"; await salvar("enviando");
    let aceito = false;
    try {
      if (contemMaps(saida.texto)) await port.marcarLocalizacao?.();
      const id = saida.tipo === "voz"
        ? await port.sendVoice!(config, message.number, audio!) : await port.send(config, message.number, saida.texto);
      aceito = true;
      saida.envio = "aceito";
      state = { ...state, providerId: id, providerIds: [...(state.providerIds ?? []), id] };
      await salvar("enviando");
      if (saida.avisoVoz) await port.confirmarAvisoVoz?.(id);
      await port.registrarParte?.(id);
    } catch (erro) {
      if (!aceito && saida.tipo === "voz" && erro instanceof EnvioVozRecusado) {
        saida.tipo = "texto"; saida.envio = "recusado"; saida.geracao = "texto_alternativo";
        state = { ...state, code: codigo(erro) }; await salvar();
        return { state, resultado: "repetir" };
      }
      if (!aceito) saida.envio = "incerto";
      state = { ...state, code: aceito ? "voz_registro_apos_aceitacao_falhou" : codigo(erro) }; await salvar("incerta");
      return { state, resultado: "incerta" };
    }
    if (indice < saidas.length - 1) {
      await salvar(); return { state, resultado: "repetir" };
    }
    // Mantém "enviando" até complete() confirmar estado e histórico atomicamente.
    state = { ...state, saidasVoz: saidas };
    return { state };
  } finally { audio?.fill(0); }
}
