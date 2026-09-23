import { sql } from "drizzle-orm";
import { chatbotSchema, type Chatbot } from "./schema";
import { linhas, type BancoSql, type TransacaoSql } from "../db/porta";

export interface ChatbotPersistido {
  id: string;
  configuracao: Chatbot;
  versao: number;
}

interface LinhaChatbot { id: string; configuration: unknown; version: number }

function converter(linha: LinhaChatbot): ChatbotPersistido {
  return {
    id: linha.id,
    configuracao: chatbotSchema.parse(linha.configuration),
    versao: Number(linha.version),
  };
}

export async function listarChatbotsServidor(banco: BancoSql): Promise<ChatbotPersistido[]> {
  const registros = linhas<LinhaChatbot>(await banco.execute(sql`SELECT id,configuration,version
    FROM atendeia_chatbots WHERE is_deleted=false ORDER BY identifier`));
  return registros.map(converter);
}

export async function chatbotDaInstancia(banco: BancoSql, instancia: string): Promise<Chatbot | null> {
  const [registro] = linhas<LinhaChatbot>(await banco.execute(sql`SELECT b.id,b.configuration,b.version
    FROM atendeia_channels c JOIN atendeia_chatbots b ON b.id=c.chatbot_id
    WHERE c.provider='evolution' AND c.instance_name=${instancia} AND c.is_deleted=false
      AND b.is_deleted=false AND b.enabled=true LIMIT 1`));
  if (registro) return converter(registro).configuracao;
  const habilitados = linhas<LinhaChatbot>(await banco.execute(sql`SELECT id,configuration,version FROM atendeia_chatbots
    WHERE is_deleted=false AND enabled=true ORDER BY updated_at DESC LIMIT 2`));
  return habilitados.length === 1 ? converter(habilitados[0]).configuracao : null;
}

export async function vincularChatbotAInstancia(tx: TransacaoSql, chatbotId: string, instancia: string, usuario: string) {
  if (!instancia) return;
  await tx.execute(sql`UPDATE atendeia_channels SET chatbot_id=${chatbotId},updated_at=now(),version=version+1,modified_by=${usuario}
    WHERE provider='evolution' AND instance_name=${instancia} AND is_deleted=false`);
}
