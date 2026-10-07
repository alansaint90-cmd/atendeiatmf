import { z } from "zod";

export const estadoPausaSchema = z.strictObject({ pausada: z.boolean(), instante: z.number().nonnegative(), eventoId: z.string() });
export function lerControlePausa(valor: string | null) {
  if (!valor?.startsWith("{")) return null;
  try { return estadoPausaSchema.parse(JSON.parse(valor)); } catch { throw new Error("Estado da pausa indisponível."); }
}
export function controlePausa(valor: string | null, agora = Date.now()) {
  const estado = lerControlePausa(valor);
  return estado ? estado.pausada : Number(valor) > agora;
}
export function mensagemAnteriorARetomada(valor: string | null, timestamp: number) {
  const estado = lerControlePausa(valor);
  return Boolean(estado && !estado.pausada && timestamp * 1000 <= estado.instante);
}
