import { pgTable, uuid, text, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "../schema";
import { colunasAuditoria, instante } from "./_compartilhado";

export const recuperacoesSenha = pgTable("atendeia_users_recuperacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  tokenHash: text("token_hash").notNull(),
  versaoUsuario: integer("versao_usuario").notNull(),
  expiraEm: instante("expira_em").notNull(),
  usadoEm: instante("usado_em"),
  ...colunasAuditoria,
  modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
}, t => [uniqueIndex("atendeia_recuperacao_hash").on(t.tokenHash)]);
export type RecuperacaoSenha = typeof recuperacoesSenha.$inferSelect;
export type NovaRecuperacaoSenha = typeof recuperacoesSenha.$inferInsert;
