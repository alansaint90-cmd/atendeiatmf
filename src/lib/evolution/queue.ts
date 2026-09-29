import { createHash, randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { EvolutionEvent } from "./schema";
import { pausaManualKey, pausaManualParaEvento } from "../agent/pausa";

export const streamKey = "atendeia:{evolution}:events";
// Atomic deduplication and enqueue. Capacity failures never silently discard data.
export const enqueueScript = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
if redis.call('XLEN', KEYS[1]) >= 1000 then return -1 end
redis.call('XADD', KEYS[1], '*', 'payload', ARGV[1])
redis.call('SET', KEYS[2], '1', 'EX', 86400)
if ARGV[2] ~= '' and tonumber(ARGV[2]) > tonumber(ARGV[3])
  and redis.call('EXISTS', KEYS[4]) == 0 then
  local anterior = tonumber(redis.call('GET', KEYS[3]) or '0')
  if tonumber(ARGV[2]) > anterior then
    redis.call('SET', KEYS[3], ARGV[2], 'PXAT', ARGV[2])
  end
end
return 1
`;

let connection: { url: string; client: Redis; ready: Promise<unknown> } | undefined;
async function getRedis(url: string): Promise<Redis> {
  if (!connection || connection.url !== url || connection.client.status === "end") {
    connection?.client.disconnect();
    const client = new Redis(url, {
      lazyConnect: true, enableOfflineQueue: false, connectTimeout: 5000,
      commandTimeout: 5000, maxRetriesPerRequest: 0, retryStrategy: () => null,
    });
    client.on("error", () => { /* The caller receives a generic 503; no secrets in logs. */ });
    connection = { url, client, ready: client.connect() };
  }
  await connection.ready;
  return connection.client;
}

export async function enqueueEvolutionEvent(event: EvolutionEvent, url: string): Promise<"queued" | "duplicate"> {
  const client = await getRedis(url);
  return enqueueEvolutionEventWithClient(client, event);
}

export async function enqueueEvolutionEventWithClient(client: Redis, event: EvolutionEvent): Promise<"queued" | "duplicate"> {
  // Without an event timestamp, recurring connection/status transitions are distinct.
  const identity = !event.date_time && event.event !== "messages.upsert" ? randomUUID() : JSON.stringify(event);
  const fingerprint = createHash("sha256").update(identity).digest("hex");
  const payload = JSON.stringify({ ...event, receivedAt: new Date().toISOString(), source: "evolution-webhook" });
  const pausa = pausaManualParaEvento(event);
  const result = await client.eval(enqueueScript, 4, streamKey, `atendeia:{evolution}:dedupe:${fingerprint}`,
    pausaManualKey(pausa?.conversation ?? "sem-conversa"), pausa?.outgoingKey ?? "atendeia:{evolution}:outgoing:sem-evento",
    payload, pausa?.ate ?? "", Date.now());
  if (result === -1) throw new Error("Queue capacity reached");
  if (result !== 0 && result !== 1) throw new Error("Unexpected queue response");
  return result === 1 ? "queued" : "duplicate";
}
