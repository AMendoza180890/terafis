/**
 * Valida variables de entorno para producción (sin imprimir secretos).
 * Uso: pnpm run check:env:prod
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const root = process.cwd();
loadDotEnv(resolve(root, ".env.production.local"));
loadDotEnv(resolve(root, ".env.local"));
loadDotEnv(resolve(root, ".env"));

process.env.NODE_ENV = "production";
process.env.TERAFIS_STRICT_ENV = "1";

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIELD_ENCRYPTION_KEY",
  "SEARCH_HMAC_KEY",
];

const errors = [];

for (const key of required) {
  if (!process.env[key]?.trim()) {
    errors.push(`Falta ${key}`);
  }
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
if (appUrl && !appUrl.startsWith("https://")) {
  errors.push("NEXT_PUBLIC_APP_URL debe usar HTTPS en producción");
}
if (/localhost|127\.0\.0\.1/i.test(appUrl)) {
  errors.push("NEXT_PUBLIC_APP_URL no puede ser localhost en producción");
}

function isKey32(b64) {
  try {
    return Buffer.from(b64, "base64").length === 32;
  } catch {
    return false;
  }
}

if (process.env.FIELD_ENCRYPTION_KEY && !isKey32(process.env.FIELD_ENCRYPTION_KEY)) {
  errors.push("FIELD_ENCRYPTION_KEY debe ser 32 bytes en base64");
}
if (process.env.SEARCH_HMAC_KEY && !isKey32(process.env.SEARCH_HMAC_KEY)) {
  errors.push("SEARCH_HMAC_KEY debe ser 32 bytes en base64");
}
if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 32) {
  errors.push("CRON_SECRET debe tener al menos 32 caracteres");
}
if (!process.env.CRON_SECRET?.trim()) {
  console.warn(
    "Aviso: CRON_SECRET no definido. /api/cron/reminders quedará inactivo hasta que un scheduler externo lo invoque con ese header.",
  );
}

for (const [key] of Object.entries(process.env)) {
  if (!key.startsWith("NEXT_PUBLIC_")) continue;
  if (/SERVICE_ROLE|DATABASE|ENCRYPTION|HMAC|SECRET|PRIVATE|PASSWORD/i.test(key)) {
    errors.push(`No use prefijo NEXT_PUBLIC_ en secreto: ${key}`);
  }
}

if (errors.length) {
  console.error("Entorno de producción inválido:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("OK: variables de entorno listas para producción (sin listar secretos).");
console.log(`  APP_URL=${appUrl}`);
console.log(`  SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log("  Secretos: presentes (no se muestran).");
