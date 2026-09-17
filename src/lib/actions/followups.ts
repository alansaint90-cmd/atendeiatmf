"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { executar, ErroDeNegocio } from "../acao";
import { exigirAdmin } from "../settings/access";
import { readSettings, saveSettings, environmentSettings, SettingsConflict } from "../settings/repository";
import { followupSchema, parseFollowup } from "../followups/schema";

export async function carregarFollowups(token: string) {
  return executar(async () => {
    await exigirAdmin(token);
    const current = await readSettings();
    const settings = { ...environmentSettings(), ...current.values };
    return { config: parseFollowup(settings.FOLLOW_UP_CONFIG), version: current.version, instance: settings.EVOLUTION_INSTANCE_NAME ?? "" };
  });
}
export async function salvarFollowups(token: string, input: unknown, version: number) {
  return executar(async () => {
    await exigirAdmin(token);
    const config = followupSchema.safeParse(input);
    if (!config.success) throw new ErroDeNegocio(config.error.issues[0].message);
    if (!z.number().int().min(0).safeParse(version).success) throw new ErroDeNegocio("Versão inválida. Recarregue os dados.");
    const current = await readSettings();
    const instance = current.values.EVOLUTION_INSTANCE_NAME ?? environmentSettings().EVOLUTION_INSTANCE_NAME;
    if (config.data.enabled && config.data.instance !== instance) throw new ErroDeNegocio("Selecione a instância Evolution configurada no servidor.");
    try {
      config.data.revision = randomUUID();
      const saved = await saveSettings({ FOLLOW_UP_CONFIG: JSON.stringify(config.data) }, version);
      return { config: config.data, version: saved.version, instance: instance ?? "" };
    } catch (error) {
      if (error instanceof SettingsConflict) throw new ErroDeNegocio("Outra sessão alterou os dados. Recarregue antes de salvar.");
      throw error;
    }
  });
}
