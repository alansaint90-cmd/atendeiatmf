import type Redis from "ioredis";
import type { EvolutionEvent } from "../evolution/schema";
import { activity } from "../followups/queue";

const cincoMinutos = 5 * 60 * 1000;
export const pausaManualKey = (conversation: string) => `atendeia:{evolution}:manual-pause:${conversation}`;

export function pausaManualParaEvento(event: EvolutionEvent) {
  const atual = activity(event, event.instance);
  if (!atual?.fromMe) return null;
  return { conversation: atual.conversation, ate: atual.timestamp * 1000 + cincoMinutos,
    outgoingKey: `atendeia:{evolution}:outgoing:${atual.identity}` };
}

export async function pausaManualAtiva(client: Redis, conversation: string, agora = Date.now()) {
  return Number(await client.get(pausaManualKey(conversation))) > agora;
}
