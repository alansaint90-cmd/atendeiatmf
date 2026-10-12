import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { chatbotDaInstancia, salvarChatbotServidor } from "../src/lib/chatbots/server-repository";
import { fluxoAcionado } from "../src/lib/agent/fluxos";

const migracao = readFileSync("src/lib/db/migrations/0012_gatilho_promocional_levaelava.sql", "utf8");
const nome = "Promoção da madrugada — R$ 13,90";
test("gatilhos atualizam fluxo legado preservando edição, versão, auditoria e outros números", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,role,modified_by) VALUES ($1,'Gerente','admin',$1)", [usuario]);
    const salvo = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "levaelava", usuario,
      configuracao: { ...chatbotExample, context: "Prompt e Maps atuais", flows: [
        { name: "Outro", description: "Instruções antigas preservadas" }, { name: nome, description: "Recepção editada pelo gerente" }] } });
    const outro = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "taistmf", usuario,
      configuracao: { ...chatbotExample, identifier: "Segundo", context: "Outro prompt" } });
    await cliente.exec(migracao);
    const atual = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.equal(atual.context, salvo.configuracao.context);
    assert.equal(atual.flows[1].description, "Recepção editada pelo gerente");
    assert.equal(fluxoAcionado(atual.flows, "quero saber sobre a promoção de 13,90")?.name, nome);
    assert.deepEqual(await chatbotDaInstancia(banco, "taistmf"), outro.configuracao);
    await cliente.exec(migracao);
    const versao = await cliente.query<{ version: number }>("SELECT version FROM atendeia_chatbots WHERE id=$1", [salvo.id]);
    assert.equal(versao.rows[0].version, salvo.versao + 1);
    const trilha = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='gatilho_promocional_por_migracao'");
    assert.equal(trilha.rows.length, 1);
    const editado = { ...atual, flows: atual.flows.map(fluxo => fluxo.name === nome ? { ...fluxo, triggers: ["Nova campanha"] } : fluxo) };
    await salvarChatbotServidor(banco, { id: salvo.id, versao: salvo.versao + 1, configuracao: editado, instancia: "levaelava", usuario });
    await cliente.exec(migracao);
    assert.deepEqual(await chatbotDaInstancia(banco, "levaelava"), editado);
  } finally { await cliente.close(); }
});

test("vínculo posterior recebe fluxo exclusivo sem alterar chatbot compartilhado", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    // A migração anterior já ocorreu sem vínculo; reproduz o provisionamento posterior.
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,role,modified_by) VALUES ($1,'Gerente','admin',$1)", [usuario]);
    const original = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "chip-antigo", usuario,
      configuracao: { ...chatbotExample, context: "Prompt original", identifier: "Compartilhado" } });
    await cliente.query("INSERT INTO atendeia_channels(name,instance_name,chatbot_id,modified_by) VALUES ('Lavanderia','levaelava',$1,$2)", [original.id, usuario]);
    await cliente.exec(migracao);
    const atual = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.notEqual(atual.id, original.id);
    assert.equal(fluxoAcionado(atual.flows, "quero saber sobre a promoção de 13,90")?.name, nome);
    assert.equal(atual.context, original.configuracao.context);
    assert.deepEqual(await chatbotDaInstancia(banco, "chip-antigo"), original.configuracao);
    await cliente.exec(migracao);
    assert.deepEqual(await chatbotDaInstancia(banco, "levaelava"), atual);
  } finally { await cliente.close(); }
});
