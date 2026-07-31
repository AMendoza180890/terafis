import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: appts } = await supabase
  .from("appointments")
  .select("id, terapeuta_id, inicio, fin, estado, tipo_servicio")
  .order("inicio", { ascending: false })
  .limit(15);

console.log("recent appointments:");
for (const a of appts ?? []) {
  console.log(
    a.estado,
    a.inicio,
    "→",
    a.fin,
    a.tipo_servicio,
    a.terapeuta_id?.slice(0, 8),
  );
}

const { data: queue } = await supabase
  .from("daily_queue")
  .select("id, fecha, estado, hora_cita, appointment_id")
  .order("fecha", { ascending: false })
  .limit(20);
console.log("\nqueue:");
for (const q of queue ?? []) {
  console.log(q.fecha, q.estado, q.hora_cita, q.appointment_id?.slice(0, 8));
}
