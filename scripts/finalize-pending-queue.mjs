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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: pending, error: listError } = await supabase
  .from("daily_queue")
  .select("id, appointment_id, estado")
  .eq("estado", "pendiente");

if (listError) {
  console.error("Error listando cola:", listError.message);
  process.exit(1);
}

const rows = pending ?? [];
console.log(`Pendientes en cola: ${rows.length}`);

if (rows.length === 0) {
  // También citas pendientes sin fila de cola
  const { data: appts, error: apptListError } = await supabase
    .from("appointments")
    .select("id, estado")
    .eq("estado", "pendiente");
  if (apptListError) {
    console.error(apptListError.message);
    process.exit(1);
  }
  console.log(`Citas en estado pendiente: ${(appts ?? []).length}`);
  if ((appts ?? []).length === 0) {
    console.log("Nada que actualizar.");
    process.exit(0);
  }
  const { error: apptUpdError } = await supabase
    .from("appointments")
    .update({ estado: "completado", updated_at: new Date().toISOString() })
    .eq("estado", "pendiente");
  if (apptUpdError) {
    console.error("Error actualizando citas:", apptUpdError.message);
    process.exit(1);
  }
  console.log(`Citas actualizadas a completado: ${(appts ?? []).length}`);
  process.exit(0);
}

const appointmentIds = [...new Set(rows.map((r) => r.appointment_id))];
const now = new Date().toISOString();

const { error: queueError } = await supabase
  .from("daily_queue")
  .update({
    estado: "completado",
    updated_at: now,
    hora_fin_atencion: now,
  })
  .eq("estado", "pendiente");

if (queueError) {
  console.error("Error actualizando cola:", queueError.message);
  process.exit(1);
}

const { error: apptError } = await supabase
  .from("appointments")
  .update({ estado: "completado", updated_at: now })
  .in("id", appointmentIds)
  .neq("estado", "completado")
  .neq("estado", "cancelado")
  .neq("estado", "no_asistio");

if (apptError) {
  console.error("Error actualizando citas:", apptError.message);
  process.exit(1);
}

console.log(`Cola actualizada: ${rows.length}`);
console.log(`Citas vinculadas: ${appointmentIds.length}`);

const { data: leftover, error: leftoverError } = await supabase
  .from("appointments")
  .select("id")
  .eq("estado", "pendiente");

if (leftoverError) {
  console.error("Error listando citas pendientes:", leftoverError.message);
  process.exit(1);
}

if ((leftover ?? []).length > 0) {
  const { error: leftoverUpd } = await supabase
    .from("appointments")
    .update({ estado: "completado", updated_at: now })
    .eq("estado", "pendiente");
  if (leftoverUpd) {
    console.error("Error cerrando citas pendientes:", leftoverUpd.message);
    process.exit(1);
  }
  console.log(`Citas pendientes adicionales → completado: ${leftover.length}`);
}

console.log("Listo: pendientes → completado (finalizado).");
