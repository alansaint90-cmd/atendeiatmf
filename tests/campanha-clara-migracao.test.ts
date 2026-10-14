import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { chatbotDaInstancia, salvarChatbotServidor } from "../src/lib/chatbots/server-repository";
import { montarInstrucoesDoAgente } from "../src/lib/chatbots/prompt-servidor";

const migracao = readFileSync("src/lib/db/migrations/0014_campanha_clara.sql", "utf8");
test("campanha aditiva preserva integralmente configuração orgânica, outros chips, versão e auditoria", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,role,modified_by) VALUES ($1,'Gerente','admin',$1)", [usuario]);
    const salvo = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "levaelava", usuario,
      configuracao: { ...chatbotExample, persona: "Clara", context: "Meu prompt original. https://maps.app.goo.gl/Exemplo",
        openingMessages: ["Recepção original"], flows: [{ name: "Promoção orgânica", description: "Descrição preservada" }] } });
    await cliente.exec(migracao);
    const atual = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.equal(atual.flows.length, salvo.configuracao.flows.length + 1);
    assert.equal(atual.flows.at(-1)?.sequencia?.mensagens.length, 4);
    assert.deepEqual({ ...atual, flows: atual.flows.slice(0, -1) }, salvo.configuracao);
    assert.equal(montarInstrucoesDoAgente(atual), montarInstrucoesDoAgente(salvo.configuracao));
    await cliente.exec(migracao);
    assert.deepEqual(await chatbotDaInstancia(banco, "levaelava"), atual);
    assert.equal((await cliente.query<{ version: number }>("SELECT version FROM atendeia_chatbots WHERE id=$1", [salvo.id])).rows[0].version, salvo.versao + 1);
    assert.equal((await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='campanha_clara_acrescentada'")).rows.length, 1);
    // Um vínculo compartilhado posterior exige cópia; seu chatbot original não muda.
    const compartilhado = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "taistmf", usuario,
      configuracao: { ...chatbotExample, identifier: "Outro", context: "Intacto", flows: [] } });
    await cliente.query("UPDATE atendeia_channels SET chatbot_id=$1 WHERE instance_name='levaelava'", [compartilhado.id]);
    await cliente.exec(migracao);
    assert.deepEqual(await chatbotDaInstancia(banco, "taistmf"), compartilhado.configuracao);
    const copia = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.notEqual(copia.id, compartilhado.id); assert.equal(copia.context, "Intacto");
    assert.equal(copia.flows.length, 1);
  } finally { await cliente.close(); }
});
