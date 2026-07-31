import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

function loadEnv() {
  const text = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function tryConnect(label, connectionString) {
  const c = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await c.connect();
    console.log("OK", label);
    await c.end();
    return true;
  } catch (e) {
    console.log("FAIL", label, e.message);
    try {
      await c.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

async function main() {
  loadEnv();
  const base = process.env.DATABASE_URL;
  const u = new URL(base);
  const pass = decodeURIComponent(u.password);
  const ref = "yqpuvyzdhajlpjfezauj";
  const candidates = [
    ["direct", base],
    [
      "pooler-session-us-east-1",
      `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    ],
    [
      "pooler-tx-us-east-1",
      `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    ],
    [
      "pooler-session-us-west-1",
      `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
    ],
    [
      "pooler-tx-us-west-2",
      `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`,
    ],
  ];
  for (const [label, cs] of candidates) {
    if (await tryConnect(label, cs)) return;
  }
}

main();
