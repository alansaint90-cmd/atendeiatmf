import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { receberOperacao } from "../src/lib/operacao/receber";
import { registrarEnvioIa } from "../src/lib/operacao/atribuir-ia";
import { consultarPainel } from "../src/lib/operacao/painel";
import type { EvolutionEvent } from "../src/lib/evolution/schema";

function evento(instancia: string, id: string, saida: boolean, telefone: string): EvolutionEvent {
  return { event: "messages.upsert", instance: instancia, data: {
    key: { id, fromMe: saida, remoteJid: `${telefone}@s.whatsapp.net` },
    pushName: "Contato real de teste", messageTimestamp: Math.floor(Date.now() / 1000),
    message: { conversation: saida ? "Resposta" : "Olá" },
  } };
}
function filtro(canalId: string | null = null) {
  return { inicio: new Date(Date.now() - 86400000).toISOString(), fim: new Date(Date.now() + 86400000).toISOString(), fuso: "UTC", canalId };
}

test("painel filtra período e canal sem atribuir envio genérico à IA ou humano", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente);
  try {
    await applyMigrations(banco);
    await receberOperacao(banco, evento("chip-a", "entrada-a", false, "5571999999999"));
    await receberOperacao(banco, evento("chip-a", "saida-sem-autoria", true, "5571999999999"));
    let painel = await consultarPainel(banco, filtro());
    assert.equal(painel.novas, 1);
    assert.equal(painel.atendimentoIa, 0);
    assert.equal(painel.atendimentoHumano, 0);
    await registrarEnvioIa(banco, "chip-a", "saida-ia-antes");
    await receberOperacao(banco, evento("chip-a", "saida-ia-antes", true, "5571999999999"));
    await receberOperacao(banco, evento("chip-a", "saida-ia-depois", true, "5571999999999"));
    await registrarEnvioIa(banco, "chip-a", "saida-ia-depois");
    painel = await consultarPainel(banco, filtro());
    assert.equal(painel.atendimentoIa, 1);
    assert.equal(painel.atendidasIa, 1);
    assert.equal(painel.atendimentoHumano, 0);
    assert.equal(painel.evolucao.reduce((soma, dia) => soma + dia.ia, 0), 1);
    await cliente.query("UPDATE atendeia_messages SET sender_type='agent',version=version+1,updated_at=now() WHERE provider_message_id='saida-sem-autoria'");
    painel = await consultarPainel(banco, filtro());
    assert.equal(painel.atendimentoHumano, 1);
    assert.equal(painel.atendidasHumano, 1);
    await receberOperacao(banco, evento("chip-b", "entrada-b", false, "5571888888888"));
    const canalA = painel.canais.find(canal => canal.nome === "chip-a")?.id;
    assert.ok(canalA);
    painel = await consultarPainel(banco, filtro(canalA));
    assert.equal(painel.novas, 1);
    assert.equal(painel.atendidasIa, 1);
    assert.equal(painel.contatos.length, 1);
    const passado = { inicio: new Date(Date.now() - 3 * 86400000).toISOString(),
      fim: new Date(Date.now() - 2 * 86400000).toISOString(), fuso: "UTC", canalId: canalA };
    assert.equal((await consultarPainel(banco, passado)).novas, 0);
    await assert.rejects(consultarPainel(banco, { ...filtro(), inicio: filtro().fim }), /início anterior/);
    assert.equal((await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='mensagem_identificada_ia'")).rows.length, 1);
  } finally { await cliente.close(); }
});
