import type Redis from "ioredis";
import { agentKeys, owned, assertResult } from "./redis";
import type { IncomingMessage } from "./message";
import type { DeliveryState } from "./processor";
import type { Turn } from "./providers";
import { streamKey } from "../evolution/queue";
import type { EstadoAvisoVoz } from "../voz/configuracao";

const retention = 30 * 86400;
const nameRetention = 100 * 86400;
export function messageStore(client: Redis, token: string, message: IncomingMessage) {
  const stateKey = `atendeia:{evolution}:reply:${message.identity}`;
  const historyKey = `atendeia:{evolution}:history:${message.conversation}`;
  const nameKey = `atendeia:{evolution}:name:${message.conversation}`;
  const mapsKey = `atendeia:{evolution}:maps:${message.conversation}`;
  const avisoKey = `atendeia:{evolution}:voice-disclosure:${message.conversation}`;
  return {
    async estadoAvisoVoz(): Promise<EstadoAvisoVoz> {
      const estado = await client.get(avisoKey);
      return estado === null ? "pendente" : estado.startsWith("confirmado:") ? "confirmado" : "reservado";
    },
    async reservarAvisoVoz(): Promise<boolean> {
      return Number(await client.eval(owned + `
        local atual = redis.call('GET', KEYS[2])
        if atual and atual ~= ARGV[2] then return 0 end
        redis.call('SET', KEYS[2], ARGV[2]); return 1`,
      2, agentKeys.lock, avisoKey, token, `reservado:${message.identity}`)) === 1;
    },
    async confirmarAvisoVoz(id: string) {
      await assertResult(await client.eval(owned + "redis.call('SET', KEYS[2], ARGV[2]); return 1",
        2, agentKeys.lock, avisoKey, token, `confirmado:${id}`));
    },
    async localizacaoEnviada(): Promise<boolean> {
      return await client.get(mapsKey) !== null;
    },
    async marcarLocalizacao() {
      // Reserva conservadora sem TTL: entrega incerta não autoriza outro envio espontâneo.
      await assertResult(await client.eval(owned + "redis.call('SET', KEYS[2], ARGV[2]); return 1",
        2, agentKeys.lock, mapsKey, token, message.identity));
    },
    async reservarFluxo(chave: string): Promise<boolean> {
      // Sem expiração: cortar o histórico ou expirar o diário não repete a campanha.
      const key = `atendeia:{evolution}:fluxo:${message.conversation}:${chave}`;
      return Number(await client.eval(owned + "return redis.call('SET', KEYS[2], ARGV[2], 'NX') and 1 or 0",
        2, agentKeys.lock, key, token, message.identity)) === 1;
    },
    async contactName(): Promise<string | null> {
      return client.get(nameKey);
    },
    async rememberName(name: string) {
      await assertResult(await client.eval(owned + "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); return 1",
        2, agentKeys.lock, nameKey, token, name, nameRetention));
    },
    async read(): Promise<DeliveryState | null> {
      const value = await client.get(stateKey);
      return value ? JSON.parse(value) as DeliveryState : null;
    },
    async write(state: DeliveryState) {
      await assertResult(await client.eval(owned + "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); return 1",
        2, agentKeys.lock, stateKey, token, JSON.stringify(state), retention));
    },
    async history(): Promise<Turn[]> {
      return (await client.lrange(historyKey, -40, -1)).map(value => JSON.parse(value) as Turn);
    },
    async complete(state: DeliveryState, turns: Turn[]) {
      await assertResult(await client.eval(owned + `
        redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
        redis.call('RPUSH', KEYS[3], ARGV[4], ARGV[5])
        redis.call('LTRIM', KEYS[3], -40, -1)
        redis.call('EXPIRE', KEYS[3], 8640000)
        return 1`, 3, agentKeys.lock, stateKey, historyKey, token, JSON.stringify(state), retention,
      JSON.stringify(turns[0]), JSON.stringify(turns[1])));
    },
  };
}

export async function finishEvent(client: Redis, token: string, id: string, payload: string, status: string) {
  // Arquivar antes de liberar espaço na fila; tudo na mesma operação Redis.
  await assertResult(await client.eval(owned + `
    redis.call('XADD', KEYS[3], 'MAXLEN', '=', 10000, '*', 'eventId', ARGV[2], 'status', ARGV[3], 'payload', ARGV[4])
    redis.call('XACK', KEYS[2], ARGV[5], ARGV[2])
    redis.call('XDEL', KEYS[2], ARGV[2])
    return 1`, 3, agentKeys.lock, streamKey, agentKeys.archive, token, id, status, payload, agentKeys.group));
}
