import { z } from "zod";

export const vozes = ["marin", "cedar", "coral", "alloy"] as const;
export const configuracaoVozSchema = z.strictObject({
  habilitada: z.boolean(),
  modo: z.enum(["texto", "audio_recebido"]),
  voz: z.enum(vozes),
  homologada: z.boolean(),
}).superRefine((valor, contexto) => {
  if (valor.habilitada && (valor.modo !== "audio_recebido" || !valor.homologada)) {
    contexto.addIssue({ code: "custom", message: "Selecione responder a áudio e homologue a voz antes de habilitar." });
  }
});
export type ConfiguracaoVoz = z.infer<typeof configuracaoVozSchema>;
export const vozDesativada: ConfiguracaoVoz = { habilitada: false, modo: "audio_recebido", voz: "marin", homologada: false };
export const avisoVozIa = "A mensagem de voz a seguir foi gerada por inteligência artificial.";
export interface SaidaVoz {
  tipo: "texto" | "voz";
  texto: string;
  geracao?: "pendente" | "gerando" | "pronta" | "texto_alternativo";
  envio?: "enviando" | "aceito" | "recusado" | "incerto";
}
export function vozPermitida(instancia: string, config: ConfiguracaoVoz | undefined, recebeuAudio: boolean, liberada: boolean): boolean {
  return liberada && instancia === "levaelava" && config?.habilitada === true
    && config.homologada && config.modo === "audio_recebido" && recebeuAudio;
}
export function textoParaFala(texto: string): string {
  // Só normaliza apresentação. Não resume, traduz nem acrescenta conteúdo comercial.
  return texto.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/&/gu, " e ").replace(/[*_~`#]/gu, "").replace(/\s+/gu, " ").trim();
}
export function planejarVoz(partes: string[]): SaidaVoz[] | null {
  const saidas: SaidaVoz[] = partes.map(texto => {
    const fala = textoParaFala(texto);
    // Informações copiáveis e procedimentos continuam nos balões de texto existentes.
    const copiavel = /https?:\/\/|\d|R\$|\b(?:pix|endereço|avenida|rua|passo|senha|código|instruções)\b|\n\s*[-•]/iu.test(texto);
    return !copiavel && fala.length >= 8 && fala.length <= 600
      ? { tipo: "voz", texto, geracao: "pendente" } : { tipo: "texto", texto };
  });
  return saidas.some(saida => saida.tipo === "voz") ? [{ tipo: "texto", texto: avisoVozIa }, ...saidas] : null;
}
