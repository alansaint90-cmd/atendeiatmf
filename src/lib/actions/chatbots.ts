"use server";
import { z } from "zod";
import { executar, ErroDeNegocio } from "../acao";
import { exigirSessao } from "../auth/sessao";
import { exigirPermissao } from "../auth/permissoes";
import { db } from "../db/client";
import { chatbotSchema } from "../chatbots/schema";
import { listarChatbotsServidor, salvarChatbotServidor } from "../chatbots/server-repository";
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
    return salvarChatbotServidor(db(), { id, versao, configuracao, instancia, usuario: sessao.userId });
  });
}
