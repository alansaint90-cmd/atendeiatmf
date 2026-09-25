import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { chatbotDaInstancia, listarChatbotsServidor, salvarChatbotServidor } from "../src/lib/chatbots/server-repository";

test("salvar prompt do SDR persiste, atualiza a versão e vincula o chatbot à instância", async () => {
  const cliente = new PGlite();
  const banco = drizzle(cliente);
  const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,email,role,enabled,modified_by) VALUES ($1,'Gerente','gerente@exemplo.test','admin',true,$1)", [usuario]);
    await cliente.query("INSERT INTO atendeia_channels(name,instance_name,modified_by) VALUES ('Canal SDR','chip-sdr',$1)", [usuario]);
    const inicial = { ...chatbotExample, context: "Instrução inicial do SDR" };
    const criado = await salvarChatbotServidor(banco, { id: null, versao: null, configuracao: inicial, instancia: "chip-sdr", usuario });
    assert.equal((await chatbotDaInstancia(banco, "chip-sdr"))?.context, inicial.context);
    const revisado = { ...inicial, context: "Nova instrução do gerente para o SDR" };
    const salvo = await salvarChatbotServidor(banco, { id: criado.id, versao: criado.versao, configuracao: revisado, instancia: "chip-sdr", usuario });
    assert.equal(salvo.versao, criado.versao + 1);
    assert.equal((await listarChatbotsServidor(banco))[0]?.configuracao.context, revisado.context);
    assert.equal((await chatbotDaInstancia(banco, "chip-sdr"))?.context, revisado.context);
    await assert.rejects(salvarChatbotServidor(banco, { id: criado.id, versao: criado.versao, configuracao: inicial, instancia: "chip-sdr", usuario }), /Outro usuário alterou/);
    const trilha = await cliente.query<{ action: string }>("SELECT action FROM atendeia_audit_logs WHERE entity_id=$1 ORDER BY created_at", [criado.id]);
    assert.deepEqual(trilha.rows.map(linha => linha.action), ["chatbot_criado", "chatbot_atualizado"]);
    const legado = { ...revisado, context: `Atenda a equipe de Wellington Junior.\nPrimeiro pergunte:\n"Claro! 😊 Você está buscando um atendimento individual ou uma mentoria em grupo?"\nSe responder individual:\nExplique a sessão.\nO grupo do evento recebe avisos.` };
    await salvarChatbotServidor(banco, { id: criado.id, versao: salvo.versao, configuracao: legado, instancia: "chip-sdr", usuario });
    const migracao = readFileSync("src/lib/db/migrations/0009_mentoria_individual.sql", "utf8");
    await cliente.exec(migracao);
    const corrigido = (await listarChatbotsServidor(banco))[0];
    assert.ok(corrigido.configuracao.context.includes("são individuais e personalizados"));
    assert.ok(corrigido.configuracao.context.includes("Primeiro explique:"));
    assert.ok(!corrigido.configuracao.context.includes("mentoria em grupo"));
    assert.ok(corrigido.configuracao.context.includes("O grupo do evento recebe avisos."));
    const auditoria = await cliente.query<{ action: string }>("SELECT action FROM atendeia_audit_logs WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 1", [criado.id]);
    assert.equal(auditoria.rows[0]?.action, "prompt_corrigido_por_migracao");
  } finally { await cliente.close(); }
});
