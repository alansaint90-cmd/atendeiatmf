"use server";
import { executar } from "../acao";
import { exigirAdmin } from "../settings/access";
import { db } from "../db/client";
import { consultarOperacao } from "../operacao/consultas";

export async function carregarOperacao(token: string) {
  return executar(async () => {
    await exigirAdmin(token);
    return consultarOperacao(db());
  });
}
