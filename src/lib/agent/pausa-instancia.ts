import type Redis from "ioredis";
import { digest } from "./message";
import { controlePausa, mensagemAnteriorARetomada } from "./controle-pausa";

export const pausaInstanciaKey = (instancia: string) => `atendeia:{evolution}:instance-pause:${digest(instancia)}`;
export async function instanciaPausada(client: Redis, instancia: string, timestamp?: number) {
  const estado = await client.get(pausaInstanciaKey(instancia));
  return controlePausa(estado) || (timestamp !== undefined && mensagemAnteriorARetomada(estado, timestamp));
}
export async function pausarInstancia(client: Redis, instancia: string, instante = Date.now()) {
  await client.eval(`
    redis.call('SET', KEYS[1], ARGV[1])
    for _, conversa in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do
      local chave = 'atendeia:{evolution}:followup:' .. conversa
      local raw = redis.call('GET', chave)
      if raw and cjson.decode(raw).instance == ARGV[2] then
        redis.call('DEL', chave); redis.call('ZREM', KEYS[2], conversa)
      end
    end
    return 1`, 2, pausaInstanciaKey(instancia), 'atendeia:{evolution}:followups',
  JSON.stringify({ pausada: true, instante, eventoId: `painel:${instante}` }), instancia);
}
