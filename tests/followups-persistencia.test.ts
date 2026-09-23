import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../src/lib/db/migrate";
import { systemUserId } from "../src/lib/db/bootstrap";
import { defaultFollowup, parseFollowup } from "../src/lib/followups/schema";
import { readSettings, saveSettings } from "../src/lib/settings/repository";

test("follow-ups são gravados e lidos novamente com auditoria no banco", async () => {
  const client = new PGlite();
  const database = drizzle(client);
  const oldKey = process.env.SETTINGS_ENCRYPTION_KEY;
  const oldAiEnabled = process.env.AI_ENABLED;
  process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.AI_ENABLED = "false";
  try {
    await applyMigrations({ transaction: work => database.transaction(tx => work(tx)) });
    const config = structuredClone(defaultFollowup);
    config.instance = "teste";
    config.enabled = true;
    config.steps[0] = { enabled: true, text: "Olá, podemos continuar?", delay: 2, unit: "hours" };
    config.steps[1] = { enabled: true, text: "Ainda posso ajudar?", delay: 72, unit: "hours" };
    config.steps[2] = { enabled: true, text: "Continuo disponível.", delay: 150, unit: "hours" };
    const current = await readSettings(database, async () => {});
    const saved = await saveSettings({ FOLLOW_UP_CONFIG: JSON.stringify(config) }, current.version, systemUserId, database, async () => {});
    assert.equal(saved.version, current.version + 1);
    const reloaded = await readSettings(database, async () => {});
    assert.deepEqual(parseFollowup(reloaded.values.FOLLOW_UP_CONFIG), config);
    const audit = await client.query<{ entity_id: string; modified_by: string }>(
      "SELECT entity_id, modified_by FROM atendeia_audit_logs WHERE action='integracoes_alteradas'");
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].modified_by, systemUserId);
  } finally {
    if (oldKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY; else process.env.SETTINGS_ENCRYPTION_KEY = oldKey;
    if (oldAiEnabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = oldAiEnabled;
    await client.close();
  }
});
