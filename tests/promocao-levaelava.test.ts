import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import { chatbotDaInstancia, salvarChatbotServidor } from "../src/lib/chatbots/server-repository";
import { configurarAgente } from "../src/lib/agent/config";
import { processMessage, type DeliveryState } from "../src/lib/agent/processor";
import type { Turn } from "../src/lib/agent/providers";

const migracao = readFileSync("src/lib/db/migrations/0011_promocao_madrugada_levaelava.sql", "utf8");
const nomeFluxo = "Promoção da madrugada — R$ 13,90";
const contexto = "Lavanderia aberta 24 horas. Endereço: Avenida de exemplo, 27. Google Maps: https://maps.google.com/?q=local-teste. Horário promocional antigo: R$ 14,90. Demais serviços seguem o catálogo cadastrado.";

test("promoção fica editável somente em levaelava, mantém o prompt e não duplica nem sobrescreve o fluxo", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,role,modified_by) VALUES ($1,'Gerente','admin',$1)", [usuario]);
    const salvo = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "levaelava", usuario,
      configuracao: { ...chatbotExample, context: contexto, persona: "Alex", openingMessages: ["Boas-vindas", "Qual é o seu nome?"],
        flows: [{ name: "Serviços", description: "Explique os serviços quando solicitado." }] } });
    const outro = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "thaistmf01", usuario,
      configuracao: { ...chatbotExample, identifier: "Outro chatbot", context: "Prompt do outro número" } });
    await cliente.exec(migracao);
    const atual = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.deepEqual({ ...atual, flows: salvo.configuracao.flows }, salvo.configuracao);
    assert.equal(atual.flows.length, 2);
    assert.equal(atual.flows[0].name, "Serviços");
    assert.equal(atual.flows[1].name, nomeFluxo);
    assert.match(atual.flows[1].description, /quero saber da promoção de 13,90/);
    assert.match(atual.flows[1].description, /R\$ 13,90, das 00h às 06h/);
    assert.match(atual.flows[1].description, /Google Maps exatamente como cadastrados/);
    assert.match(atual.flows[1].description, /continue o atendimento normal pelo prompt principal/);
    assert.deepEqual(await chatbotDaInstancia(banco, "thaistmf01"), outro.configuracao);
    const versao = await cliente.query<{ version: number }>("SELECT version FROM atendeia_chatbots WHERE id=$1", [salvo.id]);
    assert.equal(versao.rows[0].version, salvo.versao + 1);
    await assert.rejects(salvarChatbotServidor(banco, { id: salvo.id, versao: salvo.versao,
      configuracao: salvo.configuracao, instancia: "levaelava", usuario }), /Outro usuário alterou/);
    const editado = { ...atual, flows: atual.flows.map(f => f.name === nomeFluxo ? { ...f, description: "Edição do gerente preservada" } : f) };
    await salvarChatbotServidor(banco, { id: salvo.id, versao: salvo.versao + 1, configuracao: editado, instancia: "levaelava", usuario });
    await cliente.exec(migracao);
    assert.deepEqual(await chatbotDaInstancia(banco, "levaelava"), editado);
    const trilha = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='fluxo_promocional_por_migracao'");
    assert.equal(trilha.rows.length, 1);

    // O worker usa as instruções salvas e mantém o atendimento normal na mensagem seguinte.
    const config = configurarAgente({ AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo",
      EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "levaelava",
      REDIS_URL: "redis://localhost:6379" }, atual).data!;
    let estado: DeliveryState | null = null; let historico: Turn[] = []; const saidas: string[] = [];
    for (const texto of ["Quero saber mais sobre a promoção de R$ 13,90", "Qual é o horário de funcionamento?"]) {
      estado = null;
      const resultado = await processMessage({ identity: randomUUID(), conversation: "teste", number: "5511999999999", text: texto, timestamp: Date.now() / 1000 }, config,
        { read: async () => estado, write: async e => { estado = e; }, history: async () => historico, enabled: async () => true,
          generate: async (instrucao, turnos, pedido) => {
            assert.ok(instrucao.AI_SYSTEM_PROMPT.includes(contexto));
            assert.match(instrucao.AI_SYSTEM_PROMPT, /Acione cada fluxo somente/);
            assert.ok(instrucao.AI_SYSTEM_PROMPT.includes(atual.flows[1].description));
            if (pedido.includes("promoção")) {
              assert.match(instrucao.AI_SYSTEM_PROMPT, /não condicione a explicação ao fornecimento do nome/);
              return "Bem-vindo! A lavagem noturna custa R$ 13,90 das 00h às 06h. Avenida de exemplo, 27. https://maps.google.com/?q=local-teste. Qual é o seu nome?";
            }
            assert.equal(turnos.length, 2);
            return "A lavanderia está aberta 24 horas.";
          }, send: async (_c, _n, resposta) => { saidas.push(resposta); return randomUUID(); },
          complete: async (_e, turnos) => { historico = [...historico, ...turnos]; } });
      assert.equal(resultado, "enviada");
    }
    assert.equal(saidas[0].match(/seu nome/gu)?.length, 1);
    assert.equal(saidas[1], "A lavanderia está aberta 24 horas.");
  } finally { await cliente.close(); }
});

test("migração separa chatbot compartilhado e preserva o canal antigo e sua configuração", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,role,modified_by) VALUES ($1,'Gerente','admin',$1)", [usuario]);
    const original = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "chip-antigo", usuario,
      configuracao: { ...chatbotExample, context: contexto, identifier: "Compartilhado" } });
    await cliente.query("INSERT INTO atendeia_channels(name,instance_name,chatbot_id,modified_by) VALUES ('Leva Lava','levaelava',$1,$2)", [original.id, usuario]);
    await cliente.exec(migracao);
    const copia = (await chatbotDaInstancia(banco, "levaelava"))!;
    assert.notEqual(copia.id, original.configuracao.id);
    assert.equal(copia.flows[0].name, nomeFluxo);
    assert.equal(copia.context, original.configuracao.context);
    assert.deepEqual(await chatbotDaInstancia(banco, "chip-antigo"), original.configuracao);
    const vinculo = await cliente.query<{ chatbot_id: string }>("SELECT chatbot_id FROM atendeia_channels WHERE instance_name='levaelava' AND is_deleted=false");
    assert.equal(vinculo.rows[0].chatbot_id, copia.id);
    const registros = await cliente.query("SELECT id FROM atendeia_chatbots WHERE is_deleted=false");
    await cliente.exec(migracao);
    const depois = await cliente.query("SELECT id FROM atendeia_chatbots WHERE is_deleted=false");
    assert.equal(depois.rows.length, registros.rows.length);
    const trilha = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='chatbot_vinculado_por_migracao'");
    assert.equal(trilha.rows.length, 1);
  } finally { await cliente.close(); }
});

test("limite de fluxos e exclusão lógica impedem alteração parcial pela migração", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,role,modified_by) VALUES ($1,'Gerente','admin',$1)", [usuario]);
    const original = await salvarChatbotServidor(banco, { id: null, versao: null, instancia: "levaelava", usuario,
      configuracao: { ...chatbotExample, context: contexto, flows: Array.from({ length: 50 }, (_v, i) => ({ name: `Fluxo ${i}`, description: "Instruções preservadas" })) } });
    await assert.rejects(cliente.exec(migracao), /limite de 50 fluxos/);
    assert.deepEqual(await chatbotDaInstancia(banco, "levaelava"), original.configuracao);
    await cliente.query("UPDATE atendeia_channels SET is_deleted=true,deleted_at=now(),updated_at=now(),version=version+1 WHERE instance_name='levaelava' AND is_deleted=false");
    await cliente.exec(migracao);
    const trilha = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='fluxo_promocional_por_migracao'");
    assert.equal(trilha.rows.length, 0);
  } finally { await cliente.close(); }
});
