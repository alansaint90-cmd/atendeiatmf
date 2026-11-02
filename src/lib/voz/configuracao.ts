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
export const avisoVozIa = "Uso voz gerada por inteligência artificial neste atendimento.";
export const avisoVozLegado = "A mensagem de voz a seguir foi gerada por inteligência artificial.";
export type EstadoAvisoVoz = "pendente" | "reservado" | "confirmado";
export function avisoVozNoHistorico(historico: { role: string; content: string }[]): boolean {
  return historico.some(turno => turno.role === "assistant"
    && [avisoVozIa, avisoVozLegado].some(aviso => turno.content.trim() === aviso));
}
/** Restrição opcional do servidor: configuração inválida nunca libera todos os clientes. */
export function numeroLiberadoParaVoz(numero: string, restricao: string | undefined): boolean {
  if (restricao === undefined) return true;
  const numeros = z.array(z.string().regex(/^[1-9]\d{6,14}$/u)).min(1).max(20)
    .safeParse(restricao.split(",").map(valor => valor.trim()));
  return numeros.success && numeros.data.includes(numero);
}
export interface SaidaVoz {
  tipo: "texto" | "voz";
  texto: string;
  geracao?: "pendente" | "gerando" | "pronta" | "texto_alternativo";
  envio?: "enviando" | "aceito" | "recusado" | "incerto";
  avisoVoz?: boolean;
}
export function vozPermitida(instancia: string, config: ConfiguracaoVoz | undefined, recebeuAudio: boolean, liberada: boolean): boolean {
  return liberada && instancia === "levaelava" && config?.habilitada === true
    && config.homologada && config.modo === "audio_recebido" && recebeuAudio;
}
export function textoParaFala(texto: string): string {
  // Só normaliza apresentação. Não resume, traduz nem acrescenta conteúdo comercial.
  return texto.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/&/gu, " e ").replace(/[*_~`#]/gu, "").replace(/\s+/gu, " ").trim();
}
export function planejarVoz(partes: string[], incluirAviso = true): SaidaVoz[] | null {
  const saidas: SaidaVoz[] = partes.map(texto => {
    const fala = textoParaFala(texto);
    // Informações copiáveis e procedimentos continuam nos balões de texto existentes.
    const copiavel = /https?:\/\/|\d|R\$|\b(?:pix|endereço|avenida|rua|passo|senha|código|instruções)\b|\n\s*[-•]/iu.test(texto);
    return !copiavel && fala.length >= 8 && fala.length <= 600
      ? { tipo: "voz", texto, geracao: "pendente" } : { tipo: "texto", texto };
  });
  return saidas.some(saida => saida.tipo === "voz")
    ? [...(incluirAviso ? [{ tipo: "texto" as const, texto: avisoVozIa, avisoVoz: true }] : []), ...saidas] : null;
}
