import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { receberOperacao } from "../src/lib/operacao/receber";
import { incomingMessage } from "../src/lib/agent/message";
import { processMessage, type DeliveryState } from "../src/lib/agent/processor";
import { configurarAgente } from "../src/lib/agent/config";
import { chatbotExample } from "../src/lib/chatbots/defaults";
import type { EvolutionEvent } from "../src/lib/evolution/schema";
import { historicoDaConversa, mesclarHistorico } from "../src/lib/agent/historico";
import type { Turn } from "../src/lib/agent/providers";

test("mescla cache e banco sem repetir turnos e conserva revisão da IA e origem humana", () => {
  const banco: Turn[] = [{ role: "user", content: "Minha filha joga futebol", identidade: "1", instante: 1, origem: "cliente" },
    { role: "assistant", content: "Como estão as avaliações?", identidade: "2", instante: 2, origem: "ia" },
    { role: "assistant", content: "Vai participar de uma competição?", identidade: "3", instante: 3, origem: "humano" },
    { role: "user", content: "Campeonato Mineiro", identidade: "4", instante: 4, origem: "cliente" }];
  const mesclado = mesclarHistorico(banco, [banco[0], { ...banco[1], revisao: "atual" }]);
  assert.equal(mesclado.length, 4); assert.equal(mesclado[1].revisao, "atual"); assert.equal(mesclado[2].origem, "humano");
});

test("conversa já iniciada sem nome confirmado continua sem pergunta ou apresentação acrescentadas", async () => {
  const config = configurarAgente({ AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo", EVOLUTION_API_URL: "https://example.invalid",
    EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "chip-a", REDIS_URL: "redis://localhost:6379" }, { ...chatbotExample, context: "Atenda conforme o painel." }).data!;
  const historico: Turn[] = [{ role: "assistant", content: "Ela está passando por avaliações?", origem: "humano" },
    { role: "user", content: "Vai participar do campeonato Mineiro." }];
  let estado: DeliveryState | null = null;
  await processMessage({ identity: "atual", conversation: "conversa", number: "5511999999999", text: "?", timestamp: Date.now() / 1000 }, config,
    { read: async () => estado, write: async e => { estado = e; }, history: async () => historico, enabled: async () => true,
      generate: async (atual, turnos) => { assert.match(atual.AI_SYSTEM_PROMPT, /Não reinicie/); assert.deepEqual(turnos, historico); return "Sobre o campeonato, podemos continuar falando da preparação dela."; },
      send: async (_c, _n, texto) => { assert.doesNotMatch(texto, /qual.*nome|antes de começarmos|bem-vindo/iu); return "saida"; }, complete: async () => {} });
});

test("retoma após expirar o cache usando atendimento humano e nome informado, isolados por chip", async () => {
  const cliente = new PGlite(); const banco = drizzle(cliente);
  const agora = Math.floor(Date.now() / 1000);
  const evento = (id: string, texto: string, saida = false, instance = "chip-a", tempo = agora - 2 * 86400): EvolutionEvent => ({ event: "messages.upsert", instance,
    data: { key: { id, fromMe: saida, remoteJid: "5511999999999@s.whatsapp.net" }, pushName: "Nome de exibição não confirmado",
      messageTimestamp: tempo, message: { conversation: texto } } });
  try {
    await applyMigrations(banco);
    for (const e of [evento("1", "Qual é o seu nome?", true), evento("2", "Carla"),
      evento("3", "Ela está passando por avaliações?", true), evento("4", "Vai participar do campeonato Mineiro feminino."),
      evento("outro", "Assunto privado do outro número", false, "chip-b")]) await receberOperacao(banco, e);
    const novo = evento("atual", "?", false, "chip-a", agora);
    await receberOperacao(banco, novo);
    const mensagem = incomingMessage(novo, "chip-a")!;
    const historico = await historicoDaConversa(banco, "chip-a", mensagem);
    assert.deepEqual(historico.map(t => t.content), ["Qual é o seu nome?", "Carla", "Ela está passando por avaliações?", "Vai participar do campeonato Mineiro feminino."]);
    const config = configurarAgente({ AI_ENABLED: "true", OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo", EVOLUTION_API_URL: "https://example.invalid",
      EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "chip-a", REDIS_URL: "redis://localhost:6379" }, { ...chatbotExample, persona: "Derek", context: "Atenda como Derek." }).data!;
    let estado: DeliveryState | null = null; const saidas: string[] = [];
    await processMessage(mensagem, config, { read: async () => estado, write: async e => { estado = e; }, history: async () => historico,
      enabled: async () => true, rememberName: async nome => { assert.equal(nome, "Carla"); },
      generate: async (atual, turnos) => {
        assert.match(atual.AI_SYSTEM_PROMPT, /Nome confirmado pelo próprio cliente: Carla/);
        assert.match(atual.AI_SYSTEM_PROMPT, /Não reinicie/);
        assert.ok(turnos.some(t => t.content === "Ela está passando por avaliações?"));
        return "Carla, sobre a participação no campeonato, como está a preparação dela?";
      }, send: async (_c, _n, texto) => { saidas.push(texto); return "saida"; }, complete: async () => {} });
    assert.equal(saidas.length, 1); assert.doesNotMatch(saidas[0], /qual.*nome|antes de começarmos/iu);
    await cliente.query("UPDATE atendeia_contacts SET is_deleted=true,deleted_at=now(),updated_at=now(),version=version+1 WHERE is_deleted=false");
    assert.deepEqual(await historicoDaConversa(banco, "chip-a", mensagem), []);
  } finally { await cliente.close(); }
});
