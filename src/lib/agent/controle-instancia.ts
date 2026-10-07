import { sql } from "drizzle-orm";
import { linhas, type BancoSql } from "../db/porta";
import { ErroDeNegocio } from "../acao";

export async function registrarPausaDaInstancia(banco: BancoSql, instancia: string, versao: number, usuario: string, pausar: () => Promise<void>) {
  return banco.transaction(async tx => {
    const [canal] = linhas<{ id: string; version: number }>(await tx.execute(sql`UPDATE atendeia_channels
      SET version=version+1,updated_at=now(),modified_by=${usuario}
      WHERE provider='evolution' AND instance_name=${instancia} AND version=${versao} AND is_deleted=false RETURNING id,version`));
    if (!canal) throw new ErroDeNegocio("A instância foi alterada. Atualize o estado e tente novamente.");
    await tx.execute(sql`INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields)
      VALUES (${usuario},'ia_pausada','canal',${canal.id},'["pausa_ia"]'::jsonb)`);
    await pausar();
    return { pausada: true, versao: Number(canal.version) };
  });
}
