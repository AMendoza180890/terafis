import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL en .env.local");
  process.exit(1);
}

const migrationsDir = join("supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const strictTls = process.env.PGSSL_STRICT === "1";
if (!strictTls) {
  console.warn(
    "AVISO: conexión Postgres con rejectUnauthorized:false (no verifica el certificado TLS).",
  );
  console.warn(
    "Esto acepta certificados no confiables (riesgo de MITM al aplicar migraciones).",
  );
  console.warn("Para verificar TLS con la CA del sistema, ejecute con PGSSL_STRICT=1.");
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: strictTls },
});

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS public._terafis_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

const { rows: applied } = await client.query(
  "SELECT filename FROM public._terafis_migrations",
);
const done = new Set(applied.map((r) => r.filename));

console.log("Migraciones en disco:", files.length);
console.log("Ya aplicadas:", done.size);

for (const file of files) {
  if (done.has(file)) {
    console.log("SKIP", file);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log("APPLY", file, "...");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO public._terafis_migrations(filename) VALUES ($1)", [
      file,
    ]);
    await client.query("COMMIT");
    console.log("OK  ", file);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FAIL", file, e.message);
    await client.end();
    process.exit(1);
  }
}

const check = await client.query(`
  SELECT
    to_regclass('public.clinics') IS NOT NULL AS clinics,
    to_regclass('public.staff') IS NOT NULL AS staff,
    to_regclass('public.products') IS NOT NULL AS products,
    to_regclass('public.inventory_movements') IS NOT NULL AS inventory_movements,
    to_regclass('public.product_stock') IS NOT NULL AS product_stock
`);
console.log("Tablas:", check.rows[0]);

await client.end();
console.log("Listo.");
