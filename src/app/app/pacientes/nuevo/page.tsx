import { PatientForm } from "@/components/patients/PatientForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nuevo paciente — Terafis" };

export default async function NuevoPacientePage() {
  const staff = await getCurrentStaff();
  const canEditClinical = staff
    ? RoleCapabilities[staff.rol].verExpedienteClinico
    : false;
  const showReferral =
    staff?.rol === "admin" || staff?.rol === "recepcionista";

  let referringDoctors: Array<{ id: string; label: string }> = [];
  if (showReferral && staff) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("referring_doctors")
      .select("id, nombre, apellido, especialidad")
      .eq("activo", true)
      .is("deleted_at", null)
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true });
    referringDoctors = (
      (data ?? []) as Array<{
        id: string;
        nombre: string;
        apellido: string;
        especialidad: string | null;
      }>
    ).map((d) => ({
      id: d.id,
      label: d.especialidad
        ? `${d.apellido}, ${d.nombre} — ${d.especialidad}`
        : `${d.apellido}, ${d.nombre}`,
    }));
  }

  return (
    <main>
      <ActionButton
        href="/app/pacientes"
        variant="ghost"
        inline
        className="!px-2 !py-1 text-sm"
      >
        ← Pacientes
      </ActionButton>
      <h1 className="mt-3 font-serif text-3xl">Nuevo paciente</h1>
      <div className="border-brand/15 bg-surface mt-8 max-w-3xl rounded-xl border p-6">
        <PatientForm
          canEditClinical={canEditClinical}
          showReferral={showReferral}
          referringDoctors={referringDoctors}
        />
      </div>
    </main>
  );
}
