import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { seal, unseal } from "./security";
import { settingsSchema, settingNames, type IntegrationSettings } from "./schema";

let database: ReturnType<typeof drizzle> | undefined;
let initialization: Promise<void> | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  return database ??= drizzle(postgres(process.env.DATABASE_URL, { max: 3, connect_timeout: 5, idle_timeout: 20 }));
}

// Idempotent bootstrap, serialized across application replicas. No existing tables are changed.
async function initialize() {
  if (!initialization) initialization = db().transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(712940861)`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS atendeia_settings_actors (
      id text PRIMARY KEY, role text NOT NULL CHECK (role = 'super_admin'),
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
      deleted_at timestamp, is_deleted boolean NOT NULL DEFAULT false,
      modified_by text NOT NULL REFERENCES atendeia_settings_actors(id) ON DELETE RESTRICT
    )`);
    await tx.execute(sql`INSERT INTO atendeia_settings_actors (id, role, modified_by)
      VALUES ('bootstrap-admin', 'super_admin', 'bootstrap-admin') ON CONFLICT DO NOTHING`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS atendeia_integration_settings (
      id text PRIMARY KEY, encrypted_payload text NOT NULL, version integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
      deleted_at timestamp, is_deleted boolean NOT NULL DEFAULT false,
      modified_by text NOT NULL REFERENCES atendeia_settings_actors(id) ON DELETE RESTRICT
    )`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS atendeia_settings_audit (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      settings_id text NOT NULL REFERENCES atendeia_integration_settings(id) ON DELETE RESTRICT,
      version integer NOT NULL, changed_fields text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
      deleted_at timestamp, is_deleted boolean NOT NULL DEFAULT false,
      modified_by text NOT NULL REFERENCES atendeia_settings_actors(id) ON DELETE RESTRICT
    )`);
    await tx.execute(sql`INSERT INTO atendeia_integration_settings (id, encrypted_payload, modified_by)
      VALUES ('integrations', ${seal({})}, 'bootstrap-admin') ON CONFLICT DO NOTHING`);
  }).catch(error => { initialization = undefined; throw error; });
  await initialization;
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
export async function saveSettings(values: IntegrationSettings, version: number) {
  const current = await readSettings();
  if (current.version !== version) throw new SettingsConflict();
  const merged = settingsSchema.parse({ ...current.values, ...values });
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
