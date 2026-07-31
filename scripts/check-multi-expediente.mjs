import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing supabase env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probe = await sb
    .from("patient_clinical")
    .select("id, titulo, estado, fecha_apertura")
    .limit(1);

  if (probe.error) {
    console.log("PROBE_ERROR", probe.error.message);
    console.log(
      "NEED_MIGRATION: run supabase/migrations/20260730300000_multi_expediente_clinico.sql in SQL Editor",
    );
  } else {
    console.log("SCHEMA_OK", probe.data?.[0] ?? "empty");
  }

  const notesProbe = await sb
    .from("session_notes")
    .select("id, clinical_id")
    .limit(1);
  if (notesProbe.error) {
    console.log("NOTES_PROBE_ERROR", notesProbe.error.message);
  } else {
    console.log("NOTES_SCHEMA_OK");
  }

  const { count: clinicals } = await sb
    .from("patient_clinical")
    .select("id", { count: "exact", head: true });
  const { count: notes } = await sb
    .from("session_notes")
    .select("id", { count: "exact", head: true });
  console.log({ clinicals, notes });

  // Backfill orphans via REST: fetch and update in batches if clinical_id column exists
  if (!notesProbe.error) {
    const { data: orphans } = await sb
      .from("session_notes")
      .select("id, patient_id")
      .is("clinical_id", null)
      .limit(500);

    let linked = 0;
    for (const n of orphans ?? []) {
      const { data: pcs } = await sb
        .from("patient_clinical")
        .select("id")
        .eq("patient_id", n.patient_id)
        .limit(2);
      if (pcs && pcs.length === 1) {
        const { error } = await sb
          .from("session_notes")
          .update({ clinical_id: pcs[0].id })
          .eq("id", n.id);
        if (!error) linked += 1;
      }
    }
    console.log("backfill_linked", linked, "orphans_seen", orphans?.length ?? 0);
  }
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
