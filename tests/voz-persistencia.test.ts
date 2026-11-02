import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { chatbotDaInstancia, copiarChatbotParaInstancia, salvarChatbotServidor } from "../src/lib/chatbots/server-repository";
import { vozDesativada } from "../src/lib/voz/configuracao";

test("voz persiste com versão/auditoria, preserva prompt e não pode ativar nem ser copiada para outro cliente", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,email,role,enabled,modified_by) VALUES ($1,'Gerente','voz@exemplo.test','admin',true,$1)", [usuario]);
    const original = await salvarChatbotServidor(banco, { id: null, versao: null, usuario, instancia: "levaelava",
      configuracao: { ...chatbotExample, context: "Prompt original", voz: vozDesativada } });
    const ativada = { ...original.configuracao, voz: { ...vozDesativada, habilitada: true, homologada: true } };
    const salvo = await salvarChatbotServidor(banco, { id: original.id, versao: original.versao, usuario, instancia: "levaelava", configuracao: ativada });
    assert.equal(salvo.versao, original.versao + 1);
    const lido = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.deepEqual(lido.voz, ativada.voz); assert.equal(lido.context, "Prompt original");
    await assert.rejects(salvarChatbotServidor(banco, { id: original.id, versao: original.versao, usuario, instancia: "levaelava", configuracao: ativada }), /Outro usuário alterou/);
    await assert.rejects(salvarChatbotServidor(banco, { id: null, versao: null, usuario, instancia: "taistmf", configuracao: ativada }), /somente para levaelava/);
    const copia = await banco.transaction(tx => copiarChatbotParaInstancia(tx, lido, "taistmf", usuario));
    assert.equal(copia.configuracao.voz, undefined); assert.equal(copia.configuracao.context, lido.context);
    const trilha = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE entity_id=$1 AND action='chatbot_atualizado'", [original.id]);
    assert.equal(trilha.rows.length, 1);
  } finally { await cliente.close(); }
});
