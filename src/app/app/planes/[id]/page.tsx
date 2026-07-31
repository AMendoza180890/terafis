import { notFound } from "next/navigation";

import { NewVersionForm } from "@/components/plans/NewVersionForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { decryptField } from "@/lib/crypto/aes-gcm";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;
  const staff = await getCurrentStaff();
  if (!staff || staff.rol === "recepcionista") {
    return <p className="text-muted">Sin acceso al contenido clínico del plan.</p>;
  }

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

  const key = process.env.FIELD_ENCRYPTION_KEY;
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
    diagnostico: v.diagnostico && key ? safeDecrypt(v.diagnostico, key) : "(cifrado)",
    objetivo: v.objetivo && key ? safeDecrypt(v.objetivo, key) : "(cifrado)",
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
              <strong>Diagnóstico:</strong> {v.diagnostico}
            </p>
            <p>
              <strong>Objetivo:</strong> {v.objetivo}
            </p>
          </article>
        ))}
      </section>

      {latest ? (
        <NewVersionForm
          planId={id}
          defaults={{
            diagnostico: latest.diagnostico === "(cifrado)" ? "" : latest.diagnostico,
            objetivo: latest.objetivo === "(cifrado)" ? "" : latest.objetivo,
            frecuencia: latest.frecuencia,
            semanas: latest.duracion_estimada_semanas ?? undefined,
          }}
        />
      ) : null}
    </main>
  );
}

function safeDecrypt(cipher: string, key: string): string {
  try {
    return decryptField(cipher, key);
  } catch {
    return "(no descifrable)";
  }
}
