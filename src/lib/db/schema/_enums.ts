/**
 * Enums do banco: `text` + CHECK, com a lista aqui. Nunca `pgEnum` —
 * acrescentar valor em pgEnum exige migracao que nao roda dentro de transacao.
 */

/** Do maior para o menor privilegio. A ordem define a hierarquia do RBAC. */
export const PAPEIS = ["super_admin", "admin", "operador", "visualizador"] as const;
export type Papel = (typeof PAPEIS)[number];

/** Monta o CHECK de uma coluna enum a partir da lista (sem repetir os valores). */
export const listaSql = (valores: readonly string[]) =>
  valores.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
