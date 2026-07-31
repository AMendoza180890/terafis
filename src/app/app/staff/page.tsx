import { StaffForms } from "@/components/staff/StaffForms";
import { StaffMembersTable } from "@/components/staff/StaffMembersTable";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Staff — Terafis" };

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function StaffPage() {
  const me = await getCurrentStaff();
  let members: Array<{
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    rol: string;
    especialidad: string | null;
    cedula_profesional: string | null;
    mfa_habilitado: boolean;
    mfa_forzar_reinscripcion: boolean;
    activo: boolean;
  }> = [];
  let schedules: Array<{
    id: string;
    staff_id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fin: string;
  }> = [];

  if (me) {
    const supabase = await createClient();
    const [{ data: staffRows }, { data: scheduleRows }] = await Promise.all([
      supabase
        .from("staff")
        .select(
          "id, nombre, email, telefono, rol, especialidad, cedula_profesional, mfa_habilitado, mfa_forzar_reinscripcion, activo",
        )
        .is("deleted_at", null)
        .order("nombre"),
      supabase
        .from("staff_schedules")
        .select("id, staff_id, dia_semana, hora_inicio, hora_fin")
        .eq("activo", true)
        .order("dia_semana"),
    ]);
    members = (staffRows ?? []) as typeof members;
    schedules = (scheduleRows ?? []) as typeof schedules;
  }

  const canManage = me?.rol === "admin";
  const tableRows = members.map((m) => {
    const hours = schedules
      .filter((s) => s.staff_id === m.id)
      .map(
        (s) =>
          `${DIAS[s.dia_semana]} ${String(s.hora_inicio).slice(0, 5)}-${String(s.hora_fin).slice(0, 5)}`,
      )
      .join(", ");
    return { ...m, horario: hours };
  });

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Terapeutas / Staff</h1>
        <p className="text-muted mt-1 text-sm">
          Alta de usuarios, edición, activación y horario laboral.
        </p>
      </div>

      <StaffMembersTable
        members={tableRows}
        currentStaffId={me?.id ?? ""}
        canManage={Boolean(canManage)}
      />

      {canManage ? (
        <StaffForms
          members={members
            .filter((m) => m.activo)
            .map((m) => ({ id: m.id, nombre: m.nombre }))}
        />
      ) : (
        <p className="text-muted text-sm">
          Solo el administrador gestiona altas de staff.
        </p>
      )}
    </main>
  );
}
