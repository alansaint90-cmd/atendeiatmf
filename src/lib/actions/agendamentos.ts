"use server";
import { revalidatePath } from "next/cache";
import { executar, ErroDeNegocio } from "../acao";
import { exigirAdmin } from "../settings/access";
import { effectiveSettings } from "../settings/repository";
import { db } from "../db/client";
import { agendamentoSchema } from "../agendamentos/schema";
import { listarAgendamentos, salvarAgendamento, cancelarAgendamento } from "../agendamentos/repository";

export async function carregarAgendamentos(token: string) {
  return executar(async () => {
    await exigirAdmin(token);
    const config = await effectiveSettings();
    return { itens: await listarAgendamentos(db()), instancia: config.EVOLUTION_INSTANCE_NAME ?? "",
      processadorAtivo: process.env.ATENDEIA_WORKER_ENABLED === "true" };
  });
}
export async function gravarAgendamento(token: string, entrada: unknown, identidade?: unknown) {
  return executar(async () => {
    await exigirAdmin(token);
    const dados = agendamentoSchema.parse(entrada);
    const config = await effectiveSettings();
    if (dados.instancia !== config.EVOLUTION_INSTANCE_NAME) throw new ErroDeNegocio("Selecione o chip configurado no servidor.");
    const item = await salvarAgendamento(db(), dados, identidade); revalidatePath("/"); return item;
  });
}
export async function cancelarEnvioAgendado(token: string, identidade: unknown) {
  return executar(async () => {
    await exigirAdmin(token);
    const item = await cancelarAgendamento(db(), identidade); revalidatePath("/"); return item;
  });
}
