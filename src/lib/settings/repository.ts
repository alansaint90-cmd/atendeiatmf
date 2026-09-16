import { sql } from "drizzle-orm";
import { seal, unseal } from "./security";
import { settingsSchema, settingNames, type IntegrationSettings } from "./schema";
import { db } from "../db/client";
import { ensureDatabase } from "../db/migrate";
import { agentConfigSchema } from "../agent/config";

async function initialize() {
  await ensureDatabase();
  await db().execute(sql`INSERT INTO atendeia_integration_settings (id, encrypted_payload, modified_by)
    VALUES ('integrations', ${seal({})}, 'bootstrap-admin') ON CONFLICT DO NOTHING`);
}
export function environmentSettings(): IntegrationSettings {
  return Object.fromEntries(settingNames.filter(name => process.env[name]).map(name => [name, process.env[name]]));
}

export async function readSettings() {
  await initialize();
  const rows = await db().execute(sql`SELECT encrypted_payload, version FROM atendeia_integration_settings
    WHERE id = 'integrations' AND is_deleted = false`);
  if (!rows[0]) throw new Error("Settings unavailable");
  return { values: settingsSchema.parse(unseal(String(rows[0].encrypted_payload))), version: Number(rows[0].version) };
}

export class SettingsConflict extends Error {}
export class AgentSettingsIncomplete extends Error {}
export async function saveSettings(values: IntegrationSettings, version: number) {
  const current = await readSettings();
  if (current.version !== version) throw new SettingsConflict();
  const merged = settingsSchema.parse({ ...current.values, ...values });
  const effective = { ...environmentSettings(), ...merged };
  if (effective.AI_ENABLED === "true" && !agentConfigSchema.safeParse(effective).success) {
    throw new AgentSettingsIncomplete();
  }
  await db().transaction(async tx => {
    const actor = await tx.execute(sql`SELECT id FROM atendeia_settings_actors
      WHERE id = 'bootstrap-admin' AND role = 'super_admin' AND is_deleted = false`);
    if (!actor.length) throw new Error("Admin unavailable");
    const updated = await tx.execute(sql`UPDATE atendeia_integration_settings
      SET encrypted_payload = ${seal(merged)}, version = version + 1, updated_at = now(), modified_by = 'bootstrap-admin'
      WHERE id = 'integrations' AND version = ${version} AND is_deleted = false RETURNING version`);
    if (!updated.length) throw new SettingsConflict();
    await tx.execute(sql`INSERT INTO atendeia_settings_audit (settings_id, version, changed_fields, modified_by)
      VALUES ('integrations', ${version + 1}, ${Object.keys(values).join(",")}, 'bootstrap-admin')`);
  });
  return { values: merged, version: version + 1 };
}

export async function effectiveSettings() {
  const environment = environmentSettings();
  // Existing environment-only deployments continue to work until persistence is enabled.
  if (!process.env.SETTINGS_ENCRYPTION_KEY) return environment;
  return { ...environment, ...(await readSettings()).values };
}
