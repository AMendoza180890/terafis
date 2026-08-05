import { createClient } from "@/lib/supabase/server";
import { StaffRoleSchema, type StaffRole } from "@/lib/roles";

export type CurrentStaff = {
  id: string;
  clinicId: string;
  authUserId: string;
  nombre: string;
  email: string;
  telefono: string | null;
  especialidad: string | null;
  cedulaProfesional: string | null;
  avatarPath: string | null;
  rol: StaffRole;
  mfaHabilitado: boolean;
  temaPreferido: "claro" | "oscuro" | "sistema";
};

type StaffRow = {
  id: string;
  clinic_id: string;
  auth_user_id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  especialidad: string | null;
  cedula_profesional: string | null;
  avatar_path: string | null;
  rol: string;
  mfa_habilitado: boolean;
  tema_preferido: "claro" | "oscuro" | "sistema";
};

/** Obtiene el perfil staff del usuario autenticado (RLS). */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, clinic_id, auth_user_id, nombre, email, telefono, especialidad, cedula_profesional, avatar_path, rol, mfa_habilitado, tema_preferido",
    )
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .eq("activo", true)
    .maybeSingle();

  if (error || !data) {
    // Compatibilidad si aún no existe avatar_path
    if (error?.message?.includes("avatar_path")) {
      const fallback = await supabase
        .from("staff")
        .select(
          "id, clinic_id, auth_user_id, nombre, email, telefono, especialidad, cedula_profesional, rol, mfa_habilitado, tema_preferido",
        )
        .eq("auth_user_id", user.id)
        .is("deleted_at", null)
        .eq("activo", true)
        .maybeSingle();
      if (fallback.error || !fallback.data) return null;
      return mapStaff({
        ...(fallback.data as Omit<StaffRow, "avatar_path">),
        avatar_path: null,
      });
    }
    return null;
  }

  return mapStaff(data as StaffRow);
}

function mapStaff(row: StaffRow): CurrentStaff | null {
  const rol = StaffRoleSchema.safeParse(row.rol);
  if (!rol.success) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    authUserId: row.auth_user_id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    especialidad: row.especialidad,
    cedulaProfesional: row.cedula_profesional,
    avatarPath: row.avatar_path,
    rol: rol.data,
    mfaHabilitado: row.mfa_habilitado,
    temaPreferido: row.tema_preferido,
  };
}

export async function requireCurrentStaff(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    throw new Error("Sesión no autorizada.");
  }
  return staff;
}
