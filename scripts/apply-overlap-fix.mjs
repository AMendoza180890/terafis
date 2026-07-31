import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("Sin DATABASE_URL");
  process.exit(1);
}

const url = new URL(raw);
console.log("Intentando host:", url.hostname, "port:", url.port || "5432");

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730290000_citas_completadas_no_bloquean.sql",
  ),
  "utf8",
);

const candidates = [
  raw,
  // Pooler session mode (común en Supabase)
  raw
    .replace("db.", "aws-0-us-east-1.pooler.")
    .replace("postgres://", "postgresql://")
    .replace(/:(\d+)\//, ":6543/")
    .replace("postgres:", "postgres." + url.hostname.split(".")[1] + ":")
    .replace("postgres.postgres.", "postgres."),
];

// Construcción más limpia del pooler a partir del project ref
const projectRef = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
if (projectRef && process.env.DATABASE_URL) {
  const pass = decodeURIComponent(url.password);
  const user = url.username;
  for (const region of ["us-east-1", "us-west-1", "eu-west-1", "sa-east-1"]) {
    candidates.push(
      `postgresql://${user}.${projectRef}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    );
    candidates.push(
      `postgresql://${user}.${projectRef}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    );
  }
}

let lastError = null;
for (const connectionString of [...new Set(candidates)]) {
  const host = new URL(connectionString).hostname;
  process.stdout.write(`Probando ${host}… `);
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log("OK — migración aplicada");
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log("falló:", e.message?.slice(0, 80));
    lastError = e;
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

console.error("No se pudo aplicar DDL. Último error:", lastError?.message);
console.error(
  "Aplique manualmente en Supabase SQL Editor el archivo 20260730290000_citas_completadas_no_bloquean.sql",
);
process.exit(1);
