"use server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { exigirSessao } from "../auth/sessao";
import { exigirPermissao } from "../auth/permissoes";
import { executar, ErroDeNegocio } from "../acao";
import { effectiveSettings } from "../settings/repository";
import { instanciasConfiguradas } from "../evolution/instancias";
import { agentRedis } from "../agent/redis";
import { instanciaPausada, pausarInstancia } from "../agent/pausa-instancia";
import { db } from "../db/client";
import { linhas } from "../db/porta";
import { registrarPausaDaInstancia } from "../agent/controle-instancia";

const instanciaSchema = z.string().min(1).max(100).regex(/^[\p{L}\p{N}_. -]+$/u);
const pausaSchema = z.strictObject({ instancia: instanciaSchema, versao: z.number().int().nonnegative() });

export async function consultarPausaIa(entrada: unknown) {
  return executar(async () => {
    const sessao = await exigirSessao(); await exigirPermissao(sessao, "admin");
    const instancia = instanciaSchema.parse(entrada);
    const settings = await effectiveSettings();
    if (!settings.REDIS_URL || !instanciasConfiguradas(settings).includes(instancia)) throw new ErroDeNegocio("Instância indisponível para controle da IA.");
    const [canal] = linhas<{ version: number }>(await db().execute(sql`SELECT version FROM atendeia_channels
      WHERE provider='evolution' AND instance_name=${instancia} AND is_deleted=false`));
    if (!canal) throw new ErroDeNegocio("Configure o assistente desta instância antes de pausar.");
    const client = agentRedis(settings.REDIS_URL);
    try { await client.connect(); return { pausada: await instanciaPausada(client, instancia), versao: Number(canal.version) }; }
    finally { client.disconnect(); }
  });
}

export async function pausarIaInstancia(entrada: unknown) {
  return executar(async () => {
    const sessao = await exigirSessao(); await exigirPermissao(sessao, "admin");
    const { instancia, versao } = pausaSchema.parse(entrada);
    const settings = await effectiveSettings();
    if (!settings.REDIS_URL || !instanciasConfiguradas(settings).includes(instancia)) throw new ErroDeNegocio("Instância indisponível para controle da IA.");
    const client = agentRedis(settings.REDIS_URL);
    try {
      await client.connect();
      return await registrarPausaDaInstancia(db(), instancia, versao, sessao.userId, () => pausarInstancia(client, instancia));
    } finally { client.disconnect(); }
  });
}
