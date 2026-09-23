"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { executar, ErroDeNegocio } from "../acao";
import { exigirSessao } from "../auth/sessao";
import { exigirPermissao } from "../auth/permissoes";
import { db } from "../db/client";
import { linhas } from "../db/porta";
import { chatbotSchema } from "../chatbots/schema";
import { listarChatbotsServidor, vincularChatbotAInstancia } from "../chatbots/server-repository";
import { effectiveSettings } from "../settings/repository";

const salvarSchema = z.strictObject({
  id: z.uuid().nullable(),
  versao: z.number().int().min(0).nullable(),
  configuracao: chatbotSchema,
});

export async function carregarChatbots() {
  return executar(async () => {
    const sessao = await exigirSessao();
    await exigirPermissao(sessao, "admin");
    return listarChatbotsServidor(db());
  });
}

export async function salvarChatbot(entrada: unknown) {
  return executar(async () => {
    const sessao = await exigirSessao();
    await exigirPermissao(sessao, "admin");
    const validado = salvarSchema.safeParse(entrada);
    if (!validado.success) throw new ErroDeNegocio(validado.error.issues[0]?.message ?? "Configuração inválida.");
    const { id, versao, configuracao } = validado.data;
    const instancia = (await effectiveSettings()).EVOLUTION_INSTANCE_NAME ?? "";
    const salvo = await db().transaction(async tx => {
      let registros: { id: string; version: number }[];
      if (id && versao !== null) {
        registros = linhas(await tx.execute(sql`UPDATE atendeia_chatbots SET identifier=${configuracao.identifier},
          configuration=${JSON.stringify(configuracao)}::jsonb,enabled=true,updated_at=now(),version=version+1,modified_by=${sessao.userId}
          WHERE id=${id} AND version=${versao} AND is_deleted=false RETURNING id,version`));
        if (!registros.length) throw new ErroDeNegocio("Outro usuário alterou este chatbot. Recarregue a página.");
      } else {
        registros = linhas(await tx.execute(sql`INSERT INTO atendeia_chatbots(identifier,enabled,configuration,modified_by)
          VALUES (${configuracao.identifier},true,${JSON.stringify(configuracao)}::jsonb,${sessao.userId}) RETURNING id,version`));
      }
      const registro = registros[0];
      await vincularChatbotAInstancia(tx, registro.id, instancia, sessao.userId);
      await tx.execute(sql`INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields)
        VALUES (${sessao.userId},${id ? "chatbot_atualizado" : "chatbot_criado"},'chatbot',${registro.id},
          ${JSON.stringify(["identifier", "configuration", "enabled"])}::jsonb)`);
      return { id: registro.id, configuracao, versao: Number(registro.version) };
    });
    return salvo;
  });
}
