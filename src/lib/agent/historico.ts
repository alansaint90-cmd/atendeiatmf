import { sql } from "drizzle-orm";
import { linhas, type BancoSql } from "../db/porta";
import { digest, type IncomingMessage } from "./message";
import type { Turn } from "./providers";

interface Registro { provider_message_id: string; direction: string; ia: boolean; content: string; sent_at: Date | string }

/** Recupera somente textos já recebidos neste chip/cliente; não gera respostas retroativas. */
export async function historicoDaConversa(banco: BancoSql, instancia: string, mensagem: IncomingMessage): Promise<Turn[]> {
  const registros = linhas<Registro>(await banco.execute(sql`SELECT m.provider_message_id,m.direction,m.content,m.sent_at,
    (m.sender_type='bot' OR EXISTS(SELECT 1 FROM atendeia_envios_ia e WHERE e.instance_name=${instancia}
      AND e.provider_message_id=m.provider_message_id AND e.is_deleted=false)) ia
    FROM atendeia_messages m JOIN atendeia_conversations c ON c.id=m.conversation_id
    JOIN atendeia_channels ch ON ch.id=c.channel_id JOIN atendeia_contacts p ON p.id=c.contact_id
    WHERE ch.provider='evolution' AND ch.instance_name=${instancia} AND p.phone=${`+${mensagem.number}`}
      AND m.is_deleted=false AND c.is_deleted=false AND ch.is_deleted=false AND p.is_deleted=false
      AND m.message_type='text' AND m.content IS NOT NULL AND m.sent_at<=${new Date(mensagem.timestamp * 1000).toISOString()}::timestamptz
      AND m.sent_at>=${new Date((mensagem.timestamp - 100 * 86400) * 1000).toISOString()}::timestamptz
    ORDER BY m.sent_at DESC,m.created_at DESC,m.id DESC LIMIT 41`));
  const ordenados = registros.reverse();
  const atual = ordenados.findIndex(r => digest(`${instancia}:${r.provider_message_id}`) === mensagem.identity);
  return (atual < 0 ? ordenados : ordenados.slice(0, atual)).slice(-40).map(r => ({
    role: r.direction === "inbound" ? "user" : "assistant", content: r.content,
    origem: r.direction === "inbound" ? "cliente" : r.ia ? "ia" : "humano",
    identidade: digest(`${instancia}:${r.provider_message_id}`), instante: new Date(r.sent_at).getTime(),
  }));
}

export function mesclarHistorico(persistido: Turn[], cache: Turn[]): Turn[] {
  const turnos = persistido.map(t => ({ ...t }));
  for (const turno of cache) {
    const indice = turnos.findLastIndex(t => turno.identidade ? t.identidade === turno.identidade : t.role === turno.role && t.content === turno.content);
    if (indice >= 0) turnos[indice] = { ...turnos[indice], ...turno };
    else turnos.push(turno);
  }
  return turnos.sort((a, b) => (a.instante ?? 0) - (b.instante ?? 0)).slice(-40);
}
