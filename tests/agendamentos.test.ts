import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { salvarAgendamento, listarAgendamentos, cancelarAgendamento, reservarAgendamento } from "../src/lib/agendamentos/repository";
import { processarAgendamento } from "../src/lib/agendamentos/worker";
import { validarData } from "../src/lib/agendamentos/schema";

test("agendamentos persistem, cancelam com versão e não repetem entrega incerta", async () => {
  const client = new PGlite(); const banco = drizzle(client);
  const dados = () => ({ id: randomUUID(), telefone: "+5511999999999", instancia: "teste", mensagem: "Mensagem agendada de teste",
    agendadoPara: new Date(Date.now() + 3600000).toISOString() });
  const configuracoes = async () => ({ EVOLUTION_API_URL: "https://example.invalid", EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "teste" });
  let envios = 0;
  try {
    await applyMigrations({ transaction: work => banco.transaction(tx => work(tx)) });
    const entrada = dados(); const primeiro = await salvarAgendamento(banco, entrada);
    assert.equal(primeiro.status, "pendente");
    await assert.rejects(salvarAgendamento(banco, entrada), /já registrado/);
    assert.equal(await reservarAgendamento(banco, "teste"), null, "Não antecipa o envio.");
    const editado = await salvarAgendamento(banco, { ...entrada, mensagem: "Alterada" }, { id: primeiro.id, version: primeiro.version });
    await assert.rejects(cancelarAgendamento(banco, { id: primeiro.id, version: primeiro.version }), /mudou/);
    await cancelarAgendamento(banco, { id: editado.id, version: editado.version });
    assert.equal((await listarAgendamentos(banco))[0].status, "cancelado");
    const envio = await salvarAgendamento(banco, dados());
    await client.query("UPDATE atendeia_agendamentos SET agendado_para=now()-interval '1 minute' WHERE id=$1", [envio.id]);
    assert.equal(await reservarAgendamento(banco, "outro-chip"), null);
    await processarAgendamento(banco, configuracoes, async (_config, telefone, mensagem) => {
      assert.equal(telefone, "5511999999999"); assert.equal(mensagem, envio.mensagem); envios++; return "provedor-1";
    });
    await processarAgendamento(banco, configuracoes, async () => { envios++; return "duplicado"; });
    assert.equal(envios, 1);
    assert.equal((await listarAgendamentos(banco)).find(item => item.id === envio.id)?.status, "enviado");
    const incerto = await salvarAgendamento(banco, dados());
    await client.query("UPDATE atendeia_agendamentos SET agendado_para=now()-interval '1 minute' WHERE id=$1", [incerto.id]);
    await processarAgendamento(banco, configuracoes, async () => { envios++; throw new Error("timeout"); });
    await processarAgendamento(banco, configuracoes, async () => { envios++; return "duplicado"; });
    assert.equal(envios, 2);
    assert.equal((await listarAgendamentos(banco)).find(item => item.id === incerto.id)?.status, "incerto");
    const queda = await salvarAgendamento(banco, dados());
    await client.query("UPDATE atendeia_agendamentos SET agendado_para=now()-interval '1 minute' WHERE id=$1", [queda.id]);
    const reserva = await reservarAgendamento(banco, "teste"); assert.equal(reserva?.id, queda.id);
    await assert.rejects(cancelarAgendamento(banco, { id: queda.id, version: queda.version }), /envio já começou/);
    await client.query("UPDATE atendeia_agendamentos SET iniciado_em=now()-interval '6 minutes' WHERE id=$1", [queda.id]);
    assert.equal(await reservarAgendamento(banco, "teste"), null);
    assert.equal((await listarAgendamentos(banco)).find(item => item.id === queda.id)?.status, "incerto");
    const logs = await client.query("SELECT id FROM atendeia_audit_logs WHERE entity_id=$1", [envio.id]); assert.equal(logs.rows.length, 3);
    await assert.rejects(salvarAgendamento(banco, { ...dados(), agendadoPara: new Date(0).toISOString() }), /futuro/);
    await assert.rejects(salvarAgendamento(banco, { ...dados(), telefone: "sem-numero" }));
    await client.query("UPDATE atendeia_settings_actors SET is_deleted=true WHERE id='bootstrap-admin'");
    await assert.rejects(salvarAgendamento(banco, dados()), /Administrador indisponível/);
  } finally { await client.close(); }
});
test("valida a janela mínima e máxima do agendamento", () => {
  const agora = Date.now();
  assert.equal(validarData(new Date(agora).toISOString(), agora), false);
  assert.equal(validarData(new Date(agora + 60000).toISOString(), agora), true);
  assert.equal(validarData(new Date(agora + 366 * 86400000).toISOString(), agora), false);
});
