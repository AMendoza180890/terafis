import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  const text = fs.readFileSync(p, "utf8");
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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("NO_DATABASE_URL");
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patient_clinical'
      AND column_name IN ('titulo','estado','fecha_apertura','fecha_cierre')
    ORDER BY 1`);
  console.log(
    "clinical_cols",
    cols.rows.map((r) => r.column_name),
  );

  const sn = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'session_notes'
      AND column_name = 'clinical_id'`);
  const hasClinicalId = sn.rows.length > 0;
  console.log("session_clinical_id", hasClinicalId);

  if (cols.rows.length < 4 || !hasClinicalId) {
    console.log("APPLYING_MIGRATION");
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260730300000_multi_expediente_clinico.sql",
      ),
      "utf8",
    );
    await c.query(sql);
    console.log("MIGRATION_OK");
  } else {
    console.log("MIGRATION_ALREADY_APPLIED");
  }

  const backfill = await c.query(`
    UPDATE session_notes sn
    SET clinical_id = pc.id
    FROM patient_clinical pc
    WHERE sn.clinical_id IS NULL
      AND pc.patient_id = sn.patient_id
      AND (
        SELECT count(*) FROM patient_clinical x WHERE x.patient_id = sn.patient_id
      ) = 1
  `);
  console.log("backfill_orphan_notes", backfill.rowCount);

  // Set fecha_apertura from created_at when still default-ish for old rows
  const fixDates = await c.query(`
    UPDATE patient_clinical
    SET fecha_apertura = (created_at AT TIME ZONE 'America/Managua')::date
    WHERE fecha_apertura = CURRENT_DATE
      AND created_at::date < CURRENT_DATE
  `);
  console.log("fix_fecha_apertura", fixDates.rowCount);

  const counts = await c.query(`
    SELECT
      (SELECT count(*)::int FROM patient_clinical) AS clinicals,
      (SELECT count(*)::int FROM session_notes) AS notes,
      (SELECT count(*)::int FROM session_notes WHERE clinical_id IS NULL) AS notes_orphan
  `);
  console.log(counts.rows[0]);
  await c.end();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
