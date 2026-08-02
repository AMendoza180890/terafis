import { DoctorsManager } from "@/components/referring-doctors/DoctorsManager";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { requireMenuAccess } from "@/lib/permissions/require";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Doctores referidos — Terafis" };

export default async function DoctoresPage() {
  const staff = await getCurrentStaff();

  if (!staff) {
    return <p className="text-muted">Inicie sesión para gestionar doctores.</p>;
  }

  await requireMenuAccess(staff, "doctores");

  if (staff.rol !== "admin" && staff.rol !== "recepcionista") {
    return (
      <main>
        <h1 className="font-serif text-3xl">Doctores referidos</h1>
        <p className="text-muted mt-3 text-sm">
          Solo recepción y administración gestionan el catálogo de doctores.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referring_doctors")
    .select("id, nombre, apellido, direccion, telefono, especialidad, activo")
    .is("deleted_at", null)
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Doctores referidos</h1>
        <p className="text-muted mt-1 text-sm">
          Control de médicos que refieren pacientes a la clínica.
        </p>
      </div>
      {error ? (
        <p className="bg-brand-soft rounded-md p-3 text-sm">
          No se pudo cargar el catálogo: {error.message}
        </p>
      ) : (
        <DoctorsManager
          doctors={
            (data ?? []) as Array<{
              id: string;
              nombre: string;
              apellido: string;
              direccion: string | null;
              telefono: string | null;
              especialidad: string | null;
              activo: boolean;
            }>
          }
        />
      )}
    </main>
  );
}
