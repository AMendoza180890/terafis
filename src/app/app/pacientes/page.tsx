import { ActionButton } from "@/components/ui/ActionButton";
import { PatientsSearchList } from "@/components/patients/PatientsSearchList";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { loadPatientsClinicalStats } from "@/lib/patients/clinical-episodes";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pacientes — Terafis" };

type PatientRow = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  created_at: string;
};

export default async function PacientesPage() {
  const staff = await getCurrentStaff();
  let patients: PatientRow[] = [];
  let loadError: string | null = null;
  let stats = new Map<
    string,
    { patientId: string; expedientes: number; seguimientos: number }
  >();

  if (staff) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .select("id, nombre, telefono, email, created_at")
      .is("deleted_at", null)
      .order("nombre", { ascending: true })
      .limit(200);

    if (error) loadError = error.message;
    else {
      patients = (data ?? []) as PatientRow[];
      if (
        RoleCapabilities[staff.rol].verExpedienteClinico &&
        patients.length > 0
      ) {
        stats = await loadPatientsClinicalStats(
          supabase,
          patients.map((p) => p.id),
        );
      }
    }
  }

  const canAddToAttend =
    staff?.rol === "admin" || staff?.rol === "recepcionista";
  const canViewClinical = staff
    ? RoleCapabilities[staff.rol].verExpedienteClinico
    : false;

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl">Pacientes</h1>
          <p className="text-muted mt-1 text-sm">
            {staff?.rol === "recepcionista"
              ? "Registro de contacto y búsqueda para enviar a la lista de atención."
              : "Ficha administrativa y expediente clínico según su rol."}
          </p>
        </div>
        {staff?.rol !== "terapeuta" ? (
          <ActionButton href="/app/pacientes/nuevo">Nuevo paciente</ActionButton>
        ) : null}
      </div>

      {loadError ? (
        <p className="bg-brand-soft text-foreground mt-6 rounded-md p-3 text-sm">
          No se pudieron cargar pacientes: {loadError}
        </p>
      ) : (
        <PatientsSearchList
          patients={patients.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            telefono: p.telefono,
            email: p.email,
            expedientes: stats.get(p.id)?.expedientes ?? 0,
            seguimientos: stats.get(p.id)?.seguimientos ?? 0,
          }))}
          canAddToAttend={canAddToAttend}
          canViewClinical={canViewClinical}
        />
      )}
    </main>
  );
}
