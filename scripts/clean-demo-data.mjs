/**
 * Limpia datos operativos / de ejemplo y conserva catálogos + configuración.
 *
 * Conserva:
 *   clinics, clinic_config, staff, staff_schedules,
 *   rooms, services, products, referring_doctors,
 *   treatment_protocols, protocol_exercises,
 *   role_menu_permissions, staff_menu_permission_overrides,
 *   _terafis_migrations
 *
 * Elimina (operativo / demo):
 *   patients (+ clínico/consentimientos), appointments (+ cola/pagos/servicios),
 *   session_notes, treatment_plans (+ versiones/ejercicios/progreso),
 *   inventory_movements, notifications, deliveries, calendar jobs,
 *   action tokens, audit_log, staff_sessions, staff_time_off
 *
 * Uso:
 *   pnpm db:clean-demo                              # dry-run
 *   pnpm db:clean-demo:confirm                      # aplica
 *   node scripts/clean-demo-data.mjs --confirm --clinic-id=<uuid>
 *
 * Conexión:
 *   1) DATABASE_URL (Postgres / pooler)
 *   2) Fallback: Supabase REST con SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const KEEP_TABLES = [
  "clinics",
  "clinic_config",
  "staff",
  "staff_schedules",
  "rooms",
  "services",
  "products",
  "referring_doctors",
  "treatment_protocols",
  "protocol_exercises",
  "role_menu_permissions",
  "staff_menu_permission_overrides",
  "_terafis_migrations",
];

const CLEAR_TABLES = [
  "treatment_progress",
  "treatment_exercises",
  "treatment_plan_versions",
  "treatment_plans",
  "inventory_movements",
  "notification_deliveries",
  "calendar_sync_jobs",
  "appointment_action_tokens",
  "notifications",
  "payments",
  "appointment_services",
  "daily_queue",
  "session_notes",
  "patient_consents",
  "patient_clinical",
  "appointments",
  "patients",
  "staff_sessions",
  "staff_time_off",
  "audit_log",
];

/** DELETE hijos → padres (API REST y --clinic-id). */
const CLEAR_ORDER = [
  "treatment_progress",
  "treatment_exercises",
  "treatment_plan_versions",
  "treatment_plans",
  "inventory_movements",
  "notification_deliveries",
  "calendar_sync_jobs",
  "appointment_action_tokens",
  "notifications",
  "payments",
  "appointment_services",
  "daily_queue",
  "session_notes",
  "patient_consents",
  "patient_clinical",
  "appointments",
  "patients",
  "staff_sessions",
  "staff_time_off",
  "audit_log",
];

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const confirm = argv.includes("--confirm");
  const clinicArg = argv.find((a) => a.startsWith("--clinic-id="));
  const clinicId = clinicArg ? clinicArg.slice("--clinic-id=".length).trim() : null;
  if (clinicId && !/^[0-9a-f-]{36}$/i.test(clinicId)) {
    console.error("clinic-id inválido (se espera UUID).");
    process.exit(1);
  }
  return { confirm, clinicId };
}

function projectRefFromEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const m = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (m) return m[1];
  const dbUrl = process.env.DATABASE_URL ?? "";
  const m2 = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  return m2?.[1] ?? null;
}

function connectionCandidates(baseUrl) {
  const list = [["DATABASE_URL", baseUrl]];
  try {
    const u = new URL(baseUrl);
    const pass = decodeURIComponent(u.password);
    const ref = projectRefFromEnv();
    if (ref && pass) {
      for (const region of ["us-east-1", "us-west-1", "us-west-2"]) {
        list.push([
          `pooler-session-${region}`,
          `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
        ]);
        list.push([
          `pooler-tx-${region}`,
          `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
        ]);
      }
    }
  } catch {
    /* ignore */
  }
  return list;
}

async function connectPg(baseUrl) {
  for (const [label, connectionString] of connectionCandidates(baseUrl)) {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      console.log(`Conexión Postgres OK (${label})`);
      return client;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`Postgres fallida (${label}): ${msg}`);
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

async function pgTableExists(client, table) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS ok`,
    [`public.${table}`],
  );
  return Boolean(rows[0]?.ok);
}

async function pgCount(client, table, clinicId) {
  if (!(await pgTableExists(client, table))) return null;
  if (clinicId) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.${table} WHERE clinic_id = $1`,
      [clinicId],
    );
    return rows[0].n;
  }
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM public.${table}`,
  );
  return rows[0].n;
}

async function runViaPostgres(client, { confirm, clinicId }) {
  console.log("Conservar (catálogo / config):");
  for (const table of KEEP_TABLES) {
    const n = await pgCount(client, table, null);
    console.log(
      n === null ? `  - ${table}: (no existe)` : `  - ${table}: ${n} filas`,
    );
  }

  console.log("");
  console.log("Vaciar (operativo / demo):");
  const counts = {};
  for (const table of CLEAR_TABLES) {
    const n = await pgCount(client, table, clinicId);
    counts[table] = n;
    console.log(
      n === null ? `  - ${table}: (no existe)` : `  - ${table}: ${n} filas`,
    );
  }

  const total = Object.values(counts).reduce(
    (acc, n) => acc + (typeof n === "number" ? n : 0),
    0,
  );
  console.log("");
  console.log(`Total filas a eliminar: ${total}`);

  if (!confirm) {
    printDryRunHint(clinicId);
    return;
  }
  if (total === 0) {
    console.log("Nada que limpiar.");
    return;
  }

  await client.query("BEGIN");
  try {
    if (clinicId) {
      for (const table of CLEAR_ORDER) {
        if (!(await pgTableExists(client, table))) continue;
        const res = await client.query(
          `DELETE FROM public.${table} WHERE clinic_id = $1`,
          [clinicId],
        );
        console.log(`DELETE ${table}: ${res.rowCount ?? 0}`);
      }
    } else {
      const existing = [];
      for (const table of CLEAR_TABLES) {
        if (await pgTableExists(client, table)) existing.push(table);
      }
      const list = existing.map((t) => `public.${t}`).join(", ");
      await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY`);
      console.log(`TRUNCATE OK (${existing.length} tablas)`);
    }
    await client.query("COMMIT");
    console.log("");
    console.log("Limpieza completada.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Sin Postgres y faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para el fallback REST.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function apiCount(supabase, table, clinicId) {
  let q = supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { count, error } = await q;
  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.includes("does not exist") ||
      error.message?.includes("Could not find the table")
    ) {
      return null;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function apiDeleteAll(supabase, table, clinicId) {
  let q = supabase.from(table).delete({ count: "exact" }).neq("id", NIL_UUID);
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { count, error } = await q;
  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.includes("does not exist") ||
      error.message?.includes("Could not find the table")
    ) {
      return null;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function runViaApi({ confirm, clinicId }) {
  console.log("Usando fallback Supabase REST (service role)...");
  const supabase = createAdminClient();

  console.log("Conservar (catálogo / config):");
  for (const table of KEEP_TABLES) {
    if (table === "_terafis_migrations") {
      console.log(`  - ${table}: (metadato local / no vía REST)`);
      continue;
    }
    const n = await apiCount(supabase, table, null);
    console.log(
      n === null ? `  - ${table}: (no existe)` : `  - ${table}: ${n} filas`,
    );
  }

  console.log("");
  console.log("Vaciar (operativo / demo):");
  const counts = {};
  for (const table of CLEAR_ORDER) {
    const n = await apiCount(supabase, table, clinicId);
    counts[table] = n;
    console.log(
      n === null ? `  - ${table}: (no existe)` : `  - ${table}: ${n} filas`,
    );
  }

  const total = Object.values(counts).reduce(
    (acc, n) => acc + (typeof n === "number" ? n : 0),
    0,
  );
  console.log("");
  console.log(`Total filas a eliminar: ${total}`);

  if (!confirm) {
    printDryRunHint(clinicId);
    return;
  }
  if (total === 0) {
    console.log("Nada que limpiar.");
    return;
  }

  for (const table of CLEAR_ORDER) {
    if (counts[table] === null) continue;
    const deleted = await apiDeleteAll(supabase, table, clinicId);
    console.log(`DELETE ${table}: ${deleted ?? 0}`);
  }

  console.log("");
  console.log("Limpieza completada (vía REST).");
  console.log("Staff, salas, servicios, productos, protocolos y permisos se conservaron.");
}

function printDryRunHint(clinicId) {
  console.log("");
  console.log("Dry-run listo. Para aplicar:");
  console.log(
    clinicId
      ? `  node scripts/clean-demo-data.mjs --confirm --clinic-id=${clinicId}`
      : "  pnpm db:clean-demo:confirm",
  );
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv.slice(2));

  console.log("=== Terafis: limpieza de datos demo ===");
  console.log(
    opts.confirm
      ? "Modo: EJECUTAR"
      : "Modo: DRY-RUN (añada --confirm para aplicar)",
  );
  if (opts.clinicId) console.log("Alcance: clinic_id =", opts.clinicId);
  else console.log("Alcance: toda la base (todas las clínicas)");
  console.log("");

  const dbUrl = process.env.DATABASE_URL;
  let client = null;
  if (dbUrl) {
    client = await connectPg(dbUrl);
  } else {
    console.log("DATABASE_URL no definida; se usará REST.");
  }

  try {
    if (client) {
      await runViaPostgres(client, opts);
    } else {
      await runViaApi(opts);
    }
  } finally {
    if (client) await client.end();
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
