import { sql } from "drizzle-orm";
import { chatbotSchema, type Chatbot } from "./schema";
import { linhas, type BancoSql, type TransacaoSql } from "../db/porta";
import { ErroDeNegocio } from "../acao";

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

export async function salvarChatbotServidor(banco: BancoSql, dados: {
  id: string | null; versao: number | null; configuracao: Chatbot; instancia: string; usuario: string;
}): Promise<ChatbotPersistido> {
  const { id, versao, configuracao, instancia, usuario } = dados;
  return banco.transaction(async tx => {
    let registros: { id: string; version: number }[];
    if (id && versao !== null) {
      registros = linhas(await tx.execute(sql`UPDATE atendeia_chatbots SET identifier=${configuracao.identifier},
        configuration=${JSON.stringify(configuracao)}::jsonb,enabled=true,updated_at=now(),version=version+1,modified_by=${usuario}
        WHERE id=${id} AND version=${versao} AND is_deleted=false RETURNING id,version`));
      if (!registros.length) throw new ErroDeNegocio("Outro usuário alterou este chatbot. Recarregue a página.");
    } else {
      registros = linhas(await tx.execute(sql`INSERT INTO atendeia_chatbots(identifier,enabled,configuration,modified_by)
        VALUES (${configuracao.identifier},true,${JSON.stringify(configuracao)}::jsonb,${usuario}) RETURNING id,version`));
    }
    const registro = registros[0];
    await vincularChatbotAInstancia(tx, registro.id, instancia, usuario);
    await tx.execute(sql`INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields)
      VALUES (${usuario},${id ? "chatbot_atualizado" : "chatbot_criado"},'chatbot',${registro.id},
        ${JSON.stringify(["identifier", "configuration", "enabled"])}::jsonb)`);
    return { id: registro.id, configuracao, versao: Number(registro.version) };
  });
}
