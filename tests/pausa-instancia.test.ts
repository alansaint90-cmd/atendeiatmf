import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { registrarPausaDaInstancia } from "../src/lib/agent/controle-instancia";
import { controlePausa, mensagemAnteriorARetomada } from "../src/lib/agent/controle-pausa";
import type Redis from "ioredis";
import { retomarInstancia, instanciaPausada, pausaInstanciaKey } from "../src/lib/agent/pausa-instancia";

test("retomada mantém barreira para fila antiga e preserva outras pausas", async () => {
  const dados = new Map<string, string>([
    [pausaInstanciaKey("chip-a"), JSON.stringify({ pausada: true, instante: 1000, eventoId: "pausa" })],
    [pausaInstanciaKey("chip-b"), JSON.stringify({ pausada: true, instante: 1000, eventoId: "pausa" })],
    ["pausa-cliente", "humano"],
  ]);
  const redis = {
    set: async (chave: string, valor: string) => { dados.set(chave, valor); return "OK"; },
    get: async (chave: string) => dados.get(chave) ?? null,
  } as unknown as Redis;
  await retomarInstancia(redis, "chip-a", 2000);
  assert.equal(await instanciaPausada(redis, "chip-a"), false);
  assert.equal(await instanciaPausada(redis, "chip-a", 1), true);
  assert.equal(await instanciaPausada(redis, "chip-a", 3), false);
  assert.equal(await instanciaPausada(redis, "chip-b"), true);
  assert.equal(dados.get("pausa-cliente"), "humano");
});

test("pausa permanente não expira e a retomada não responde mensagens anteriores", () => {
  const pausada = JSON.stringify({ pausada: true, instante: 1000, eventoId: "humano" });
  const liberada = JSON.stringify({ pausada: false, instante: 2000, eventoId: "gatilho" });
  assert.equal(controlePausa(pausada, 100000000000), true);
  assert.equal(controlePausa(liberada), false);
  assert.equal(mensagemAnteriorARetomada(liberada, 1), true);
  assert.equal(mensagemAnteriorARetomada(liberada, 3), false);
});

test("pausar instância exige versão atual e audita somente o canal selecionado", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente); const usuario = randomUUID();
  try {
    await applyMigrations(banco);
    await cliente.query("INSERT INTO atendeia_users(id,name,email,role,enabled,modified_by) VALUES ($1,'Gerente','pausa@exemplo.test','admin',true,$1)", [usuario]);
    await cliente.query("INSERT INTO atendeia_channels(name,instance_name,modified_by) VALUES ('A','chip-a',$1),('B','chip-b',$1)", [usuario]);
    let chamadas = 0;
    const salvo = await registrarPausaDaInstancia(banco, "chip-a", 0, usuario, async () => { chamadas++; });
    assert.equal(salvo.pausada, true); assert.equal(salvo.versao, 1);
    await assert.rejects(registrarPausaDaInstancia(banco, "chip-a", 0, usuario, async () => { chamadas++; }), /alterada/);
    assert.equal(chamadas, 1);
    const canais = await cliente.query<{ instance_name: string; version: number }>("SELECT instance_name,version FROM atendeia_channels WHERE is_deleted=false ORDER BY instance_name");
    assert.deepEqual(canais.rows.map(c => [c.instance_name, c.version]), [["chip-a", 1], ["chip-b", 0]]);
    const auditoria = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='ia_pausada' AND modified_by=$1", [usuario]);
    assert.equal(auditoria.rows.length, 1);
    await assert.rejects(registrarPausaDaInstancia(banco, "chip-a", 1, usuario, async () => { throw new Error("Redis indisponível"); }), /Redis/);
    const depois = await cliente.query<{ version: number }>("SELECT version FROM atendeia_channels WHERE instance_name='chip-a' AND is_deleted=false");
    assert.equal(depois.rows[0].version, 1);
    const retomada = await registrarPausaDaInstancia(banco, "chip-a", 1, usuario, async () => { chamadas++; }, false);
    assert.deepEqual(retomada, { pausada: false, versao: 2 });
    const retomadas = await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='ia_retomada' AND modified_by=$1", [usuario]);
    assert.equal(retomadas.rows.length, 1);
    const outro = await cliente.query<{ version: number }>("SELECT version FROM atendeia_channels WHERE instance_name='chip-b'");
    assert.equal(outro.rows[0].version, 0);
  } finally { await cliente.close(); }
});
