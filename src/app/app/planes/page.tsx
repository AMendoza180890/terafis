import { PlansManager } from "@/components/plans/PlansManager";
import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Planes de tratamiento — Terafis" };

export default async function PlanesPage() {
  const staff = await getCurrentStaff();

  if (staff?.rol === "recepcionista") {
    return (
      <main>
        <h1 className="font-serif text-3xl">Planes de tratamiento</h1>
        <p className="text-muted mt-3 text-sm">
          Recepción puede ver que un paciente tiene plan activo, pero no el contenido
          clínico (diagnóstico, ejercicios detallados).
        </p>
        <ReceptionPlansList />
      </main>
    );
  }

  let plans: Array<{
    id: string;
    patient_id: string;
    version_actual: number;
    activo: boolean;
    updated_at: string;
  }> = [];
  let patients: Array<{ id: string; nombre: string }> = [];
  let protocols: Array<{ id: string; titulo: string; codigo: string }> = [];

  if (staff) {
    const supabase = await createClient();
    const [{ data: planRows }, { data: pats }, { data: protos }] = await Promise.all([
      supabase
        .from("treatment_plans")
        .select("id, patient_id, version_actual, activo, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("patients")
        .select("id, nombre")
        .is("deleted_at", null)
        .order("nombre"),
      supabase
        .from("treatment_protocols")
        .select("id, titulo, codigo")
        .eq("activo", true)
        .order("titulo"),
    ]);
    plans = (planRows ?? []) as typeof plans;
    patients = (pats ?? []) as typeof patients;
    protocols = (protos ?? []) as typeof protocols;
  }

  const nameMap = new Map(patients.map((p) => [p.id, p.nombre]));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Planes de tratamiento</h1>
        <p className="text-muted mt-1 text-sm">
          Versionados y auditados. Diagnóstico/objetivo cifrados en reposo.
        </p>
      </div>

      <ul className="border-brand/15 bg-surface space-y-2 rounded-xl border p-4 text-sm">
        {plans.length === 0 ? (
          <li className="text-muted">Sin planes aún.</li>
        ) : (
          plans.map((p) => (
            <li
              key={p.id}
              className="border-brand/5 flex flex-col gap-2 border-b py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                {nameMap.get(p.patient_id) ?? "Paciente"} · v{p.version_actual}
                {!p.activo ? " (inactivo)" : ""}
              </span>
              <ActionButton href={`/app/planes/${p.id}`} variant="secondary">
                Ver
              </ActionButton>
            </li>
          ))
        )}
      </ul>

      {staff ? (
        <PlansManager
          patients={patients}
          protocols={protocols}
          isAdmin={staff.rol === "admin"}
          defaultTerapeutaId={staff.id}
        />
      ) : null}
    </main>
  );
}

async function ReceptionPlansList() {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("treatment_plans")
    .select("id, patient_id, activo, version_actual")
    .eq("activo", true)
    .limit(50);
  const { data: pats } = await supabase.from("patients").select("id, nombre");
  const names = new Map(
    ((pats ?? []) as Array<{ id: string; nombre: string }>).map((p) => [p.id, p.nombre]),
  );
  return (
    <ul className="mt-6 space-y-2 text-sm">
      {(
        (data ?? []) as Array<{ id: string; patient_id: string; version_actual: number }>
      ).map((p) => (
        <li key={p.id} className="border-brand/10 rounded-md border px-3 py-2">
          {names.get(p.patient_id) ?? "Paciente"} — plan activo (v{p.version_actual})
        </li>
      ))}
    </ul>
  );
}
