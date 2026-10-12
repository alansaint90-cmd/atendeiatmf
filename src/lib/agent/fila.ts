import type Redis from "ioredis";
import { z } from "zod";
import { streamKey } from "../evolution/queue";
import { agentKeys, owned, assertResult } from "./redis";

const streamResult = z.array(z.tuple([z.string(), z.array(z.tuple([z.string(), z.array(z.string())]))]));
type EventoDaFila = [string, string[]];
export function instanciaDoEvento(fields: string[]): string {
  const indice = fields.indexOf("payload");
  try {
    const valor: unknown = JSON.parse(indice >= 0 ? fields[indice + 1] : "{}");
    return z.object({ instance: z.string() }).safeParse(valor).data?.instance ?? "";
  } catch { return ""; }
}

export function selecionarEvento(eventos: EventoDaFila[], ultimaInstancia: string | null, instanciasConfiguradas: string[]): EventoDaFila | null {
  // Sempre o mais antigo de cada chip; alternar chips não reordena uma conversa.
  const primeiros = new Map<string, EventoDaFila>();
  for (const evento of eventos) {
    const instancia = instanciaDoEvento(evento[1]);
    if (!primeiros.has(instancia)) primeiros.set(instancia, evento);
  }
  if (!primeiros.size) return null;
  if (ultimaInstancia === null) return eventos[0];
  // A ordem não pode mudar quando um chip esvazia sua parte da fila.
  const ordemInstancias = [...new Set([...instanciasConfiguradas, ...primeiros.keys()])];
  const indice = ordemInstancias.indexOf(ultimaInstancia);
  for (let distancia = 1; distancia <= ordemInstancias.length; distancia++) {
    const evento = primeiros.get(ordemInstancias[(indice + distancia) % ordemInstancias.length]);
    if (evento) return evento;
  }
  return null;
}

export async function lerEventoDaFila(client: Redis, token: string, instanciasConfiguradas: string[]): Promise<EventoDaFila | null> {
  try { await client.xgroup("CREATE", streamKey, agentKeys.group, "0", "MKSTREAM"); }
  catch (error) { if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error; }
  const pendentes = await client.xreadgroup("GROUP", agentKeys.group, agentKeys.consumer, "COUNT", 1000, "STREAMS", streamKey, "0");
  const novos = await client.xreadgroup("GROUP", agentKeys.group, agentKeys.consumer, "COUNT", 1000, "STREAMS", streamKey, ">");
  const eventos = [...(streamResult.parse(pendentes ?? [])[0]?.[1] ?? []), ...(streamResult.parse(novos ?? [])[0]?.[1] ?? [])];
  const selecionado = selecionarEvento(eventos, await client.get(agentKeys.lastInstance), instanciasConfiguradas);
  if (selecionado) await assertResult(await client.eval(owned + "redis.call('SET', KEYS[2], ARGV[2]); return 1",
    2, agentKeys.lock, agentKeys.lastInstance, token, instanciaDoEvento(selecionado[1])));
  return selecionado;
}
