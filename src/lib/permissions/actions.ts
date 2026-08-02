"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  CODE_ROLE_MENU_DEFAULTS,
  isMenuKey,
  MENU_KEYS,
  type MenuKey,
} from "@/lib/permissions/menu-catalog";
import {
  SaveRoleMenuPermissionsSchema,
  SaveStaffMenuOverridesSchema,
} from "@/lib/permissions/schemas";
import type { StaffRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false as const, error: "Solo admin gestiona permisos", staff };
  }
  return { ok: true as const, staff };
}

export async function listRoleMenuPermissionsAction(rol: StaffRole) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_menu_permissions")
    .select("menu_key, allowed")
    .eq("clinic_id", gate.staff.clinicId)
    .eq("rol", rol);

  if (error && /relation|does not exist|schema cache/i.test(error.message)) {
    return {
      ok: true as const,
      allowedKeys: CODE_ROLE_MENU_DEFAULTS[rol],
      missingMigration: true as const,
    };
  }
  if (error) return { ok: false as const, error: error.message };

  const map = new Map(
    ((data ?? []) as Array<{ menu_key: string; allowed: boolean }>).map(
      (r) => [r.menu_key, r.allowed] as const,
    ),
  );
  const allowedKeys = MENU_KEYS.filter((k) => {
    if (map.has(k)) return map.get(k) === true;
    return CODE_ROLE_MENU_DEFAULTS[rol].includes(k);
  });

  return { ok: true as const, allowedKeys, missingMigration: false as const };
}

export async function saveRoleMenuPermissionsAction(raw: unknown): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = SaveRoleMenuPermissionsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { rol, allowedKeys } = parsed.data;
  const keys = new Set<MenuKey>(allowedKeys);
  keys.add("inicio");
  if (rol === "admin") keys.add("permisos");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const rows = MENU_KEYS.map((menu_key) => ({
    clinic_id: gate.staff.clinicId,
    rol,
    menu_key,
    allowed: keys.has(menu_key),
    updated_at: now,
  }));

  const { error } = await supabase.from("role_menu_permissions").upsert(rows, {
    onConflict: "clinic_id,rol,menu_key",
  });

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff: gate.staff,
    accion: "permission.role_update",
    tabla: "role_menu_permissions",
    diff: { rol, allowedKeys: [...keys] },
  });

  revalidatePath("/app");
  revalidatePath("/app/permisos");
  return { ok: true };
}

export async function listStaffForPermissionsAction() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, nombre, email, rol, activo")
    .eq("clinic_id", gate.staff.clinicId)
    .is("deleted_at", null)
    .order("nombre");

  if (error) return { ok: false as const, error: error.message };

  return {
    ok: true as const,
    staff: (data ?? []) as Array<{
      id: string;
      nombre: string;
      email: string;
      rol: StaffRole;
      activo: boolean;
    }>,
  };
}

export async function getStaffMenuOverridesAction(staffId: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("staff")
    .select("id, rol, nombre")
    .eq("id", staffId)
    .eq("clinic_id", gate.staff.clinicId)
    .maybeSingle();

  if (!member) return { ok: false as const, error: "Usuario no encontrado" };

  const rol = (member as { rol: StaffRole }).rol;

  const [roleRes, overrideRes] = await Promise.all([
    supabase
      .from("role_menu_permissions")
      .select("menu_key, allowed")
      .eq("clinic_id", gate.staff.clinicId)
      .eq("rol", rol),
    supabase
      .from("staff_menu_permission_overrides")
      .select("menu_key, allowed")
      .eq("clinic_id", gate.staff.clinicId)
      .eq("staff_id", staffId),
  ]);

  const roleDefaults: Partial<Record<MenuKey, boolean>> = {};
  for (const key of MENU_KEYS) {
    roleDefaults[key] = CODE_ROLE_MENU_DEFAULTS[rol].includes(key);
  }
  for (const row of (roleRes.data ?? []) as Array<{
    menu_key: string;
    allowed: boolean;
  }>) {
    if (isMenuKey(row.menu_key)) roleDefaults[row.menu_key] = row.allowed;
  }

  const overrides: Partial<Record<MenuKey, boolean>> = {};
  for (const row of (overrideRes.data ?? []) as Array<{
    menu_key: string;
    allowed: boolean;
  }>) {
    if (isMenuKey(row.menu_key)) overrides[row.menu_key] = row.allowed;
  }

  return {
    ok: true as const,
    staffId,
    staffNombre: (member as { nombre: string }).nombre,
    rol,
    roleDefaults,
    overrides,
  };
}

export async function saveStaffMenuOverridesAction(raw: unknown): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = SaveStaffMenuOverridesSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { staffId, overrides } = parsed.data;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("staff")
    .select("id, rol")
    .eq("id", staffId)
    .eq("clinic_id", gate.staff.clinicId)
    .maybeSingle();

  if (!member) return { ok: false, error: "Usuario no encontrado" };

  // Admin no puede quitarse a sí mismo el acceso a permisos.
  if (staffId === gate.staff.id && overrides.permisos === false) {
    return {
      ok: false,
      error: "No puede quitarse a sí mismo el acceso a Permisos",
    };
  }

  const now = new Date().toISOString();
  const entries = Object.entries(overrides).filter(([k]) => isMenuKey(k)) as Array<
    [MenuKey, boolean]
  >;

  // Eliminar overrides previos del usuario y reinsertar los definidos.
  const { error: delErr } = await supabase
    .from("staff_menu_permission_overrides")
    .delete()
    .eq("clinic_id", gate.staff.clinicId)
    .eq("staff_id", staffId);

  if (delErr) return { ok: false, error: delErr.message };

  if (entries.length > 0) {
    const rows = entries
      .filter(([key]) => key !== "inicio")
      .map(([menu_key, allowed]) => ({
        clinic_id: gate.staff.clinicId,
        staff_id: staffId,
        menu_key,
        allowed,
        updated_at: now,
      }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("staff_menu_permission_overrides")
        .insert(rows);
      if (error) return { ok: false, error: error.message };
    }
  }

  await writeAuditLog({
    staff: gate.staff,
    accion: "permission.staff_override",
    tabla: "staff_menu_permission_overrides",
    registroId: staffId,
    diff: { overrides },
  });

  revalidatePath("/app");
  revalidatePath("/app/permisos");
  return { ok: true };
}
