"use server";
import { executar } from "../acao";
import { exigirAdmin } from "../settings/access";
import { db } from "../db/client";
import { ensureDatabase } from "../db/migrate";
import { listTags, mutateTag } from "../tags/repository";
import { revalidatePath } from "next/cache";

export async function carregarTags(token: string) {
  return executar(async () => { await exigirAdmin(token); await ensureDatabase(); return listTags(db()); });
}
export async function salvarTag(token: string, value: unknown, identity?: unknown) {
  return executar(async () => {
    await exigirAdmin(token); await ensureDatabase();
    const tag = await mutateTag(db(), value, identity);
    revalidatePath("/"); return tag;
  });
}
export async function excluirTag(token: string, identity: unknown) {
  return executar(async () => {
    await exigirAdmin(token); await ensureDatabase();
    const tag = await mutateTag(db(), null, identity, true);
    revalidatePath("/"); return tag;
  });
}
