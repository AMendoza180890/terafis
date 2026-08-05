import { notFound } from "next/navigation";

import { NewVersionForm } from "@/components/plans/NewVersionForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { decryptField } from "@/lib/crypto/aes-gcm";
import { TREATMENT_PLAN_FIELD_LABELS } from "@/lib/labels/treatment-plan";
import { requireMenuAccess } from "@/lib/permissions/require";
import { createClient } from "@/lib/supabase/server";
import { exercisesToDetalle } from "@/lib/treatment-plans/schemas";

type Props = { params: Promise<{ id: string }> };

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;
  const staff = await getCurrentStaff();
  if (!staff || staff.rol === "recepcionista") {
    return <p className="text-muted">Sin acceso al contenido clínico del plan.</p>;
  }
  await requireMenuAccess(staff, "planes");

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id, patient_id, version_actual, activo")
    .eq("id", id)
    .maybeSingle();
  if (!plan) notFound();

  const { data: versions } = await supabase
    .from("treatment_plan_versions")
    .select(
      "id, version, diagnostico, objetivo, frecuencia, duracion_estimada_semanas, created_at",
    )
    .eq("plan_id", id)
    .order("version", { ascending: false });

  const versionIds = ((versions ?? []) as Array<{ id: string }>).map((v) => v.id);
  const { data: exercises } =
    versionIds.length > 0
      ? await supabase
          .from("treatment_exercises")
          .select("plan_version_id, nombre, descripcion, series, repeticiones, orden")
          .in("plan_version_id", versionIds)
          .order("orden", { ascending: true })
      : { data: [] };

  const key = process.env.FIELD_ENCRYPTION_KEY;
  const decrypt = (cipher: string | null) => {
    if (!cipher) return "";
    if (!key) return "(cifrado)";
    try {
      return decryptField(cipher, key);
    } catch {
      return "(no descifrable)";
    }
  };

  const byVersionRows = new Map<
    string,
    Array<{
      nombre: string;
      descripcion: string | null;
      series: number | null;
      repeticiones: number | null;
    }>
  >();
  for (const e of (exercises ?? []) as Array<{
    plan_version_id: string;
    nombre: string;
    descripcion: string | null;
    series: number | null;
    repeticiones: number | null;
  }>) {
    const arr = byVersionRows.get(e.plan_version_id) ?? [];
    arr.push({
      nombre: e.nombre,
      descripcion: decrypt(e.descripcion),
      series: e.series,
      repeticiones: e.repeticiones,
    });
    byVersionRows.set(e.plan_version_id, arr);
  }

  const rows = (
    (versions ?? []) as Array<{
      id: string;
      version: number;
      diagnostico: string | null;
      objetivo: string | null;
      frecuencia: string;
      duracion_estimada_semanas: number | null;
      created_at: string;
    }>
  ).map((v) => ({
    ...v,
    diagnostico: v.diagnostico ? decrypt(v.diagnostico) || "(cifrado)" : "",
    objetivo: v.objetivo ? decrypt(v.objetivo) || "(cifrado)" : "",
    ejerciciosDetalle: exercisesToDetalle(byVersionRows.get(v.id) ?? []),
  }));

  const latest = rows[0];

  return (
    <main className="space-y-6">
      <ActionButton
        href="/app/planes"
        variant="ghost"
        inline
        className="!px-2 !py-1 text-sm"
      >
        ← Planes
      </ActionButton>
      <h1 className="font-serif text-3xl">
        Plan · v{(plan as { version_actual: number }).version_actual}
      </h1>

      <section className="border-brand/15 bg-surface space-y-4 rounded-xl border p-5">
        <h2 className="font-semibold">Historial de versiones</h2>
        {rows.map((v) => (
          <article
            key={v.id}
            className="border-brand/10 border-b pb-3 text-sm last:border-0"
          >
            <p className="font-medium">Versión {v.version}</p>
            <p className="text-muted text-xs">{v.frecuencia}</p>
            <p className="mt-2">
              <strong>{TREATMENT_PLAN_FIELD_LABELS.diagnostico}:</strong>{" "}
              {v.diagnostico}
            </p>
            <p>
              <strong>{TREATMENT_PLAN_FIELD_LABELS.objetivo}:</strong>{" "}
              {v.objetivo}
            </p>
            {v.ejerciciosDetalle ? (
              <p className="mt-2 whitespace-pre-wrap">
                <strong>
                  {TREATMENT_PLAN_FIELD_LABELS.ejerciciosDetalle}:
                </strong>
                {"\n"}
                {v.ejerciciosDetalle}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      {latest ? (
        <NewVersionForm
          planId={id}
          defaults={{
            diagnostico:
              latest.diagnostico === "(cifrado)" ||
              latest.diagnostico === "(no descifrable)"
                ? ""
                : latest.diagnostico,
            objetivo:
              latest.objetivo === "(cifrado)" || latest.objetivo === "(no descifrable)"
                ? ""
                : latest.objetivo,
            frecuencia: latest.frecuencia,
            semanas: latest.duracion_estimada_semanas ?? undefined,
            ejerciciosDetalle: latest.ejerciciosDetalle,
          }}
        />
      ) : null}
    </main>
  );
}
