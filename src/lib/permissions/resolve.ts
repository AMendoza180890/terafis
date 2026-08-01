import type { CurrentStaff } from "@/lib/auth/current-staff";
import {
  CODE_ROLE_MENU_DEFAULTS,
  isMenuKey,
  MENU_KEYS,
  resolveEffectiveMenuKeys,
  type MenuKey,
} from "@/lib/permissions/menu-catalog";
import type { StaffRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type MenuAccessMaps = {
  roleDefaults: Partial<Record<MenuKey, boolean>>;
  overrides: Partial<Record<MenuKey, boolean>>;
  effectiveKeys: MenuKey[];
};

function mapsFromRows(
  role: StaffRole,
  roleRows: Array<{ menu_key: string; allowed: boolean }>,
  overrideRows: Array<{ menu_key: string; allowed: boolean }>,
): MenuAccessMaps {
  const roleDefaults: Partial<Record<MenuKey, boolean>> = {};
  for (const row of roleRows) {
    if (isMenuKey(row.menu_key)) roleDefaults[row.menu_key] = row.allowed;
  }
  for (const key of MENU_KEYS) {
    if (roleDefaults[key] === undefined) {
      roleDefaults[key] = CODE_ROLE_MENU_DEFAULTS[role].includes(key);
    }
  }

  const overrides: Partial<Record<MenuKey, boolean>> = {};
  for (const row of overrideRows) {
    if (isMenuKey(row.menu_key)) overrides[row.menu_key] = row.allowed;
  }

  const effective = resolveEffectiveMenuKeys({ role, roleDefaults, overrides });
  return {
    roleDefaults,
    overrides,
    effectiveKeys: MENU_KEYS.filter((k) => effective.has(k)),
  };
}

/** Resuelve menú efectivo para el staff autenticado. */
export async function getEffectiveMenuAccessForStaff(
  staff: CurrentStaff,
): Promise<MenuAccessMaps> {
  const supabase = await createClient();

  const [roleRes, overrideRes] = await Promise.all([
    supabase
      .from("role_menu_permissions")
      .select("menu_key, allowed")
      .eq("clinic_id", staff.clinicId)
      .eq("rol", staff.rol),
    supabase
      .from("staff_menu_permission_overrides")
      .select("menu_key, allowed")
      .eq("clinic_id", staff.clinicId)
      .eq("staff_id", staff.id),
  ]);

  if (
    roleRes.error &&
    /relation|does not exist|schema cache/i.test(roleRes.error.message)
  ) {
    const roleDefaults: Partial<Record<MenuKey, boolean>> = {};
    for (const key of MENU_KEYS) {
      roleDefaults[key] = CODE_ROLE_MENU_DEFAULTS[staff.rol].includes(key);
    }
    const effective = resolveEffectiveMenuKeys({
      role: staff.rol,
      roleDefaults,
      overrides: {},
    });
    return {
      roleDefaults,
      overrides: {},
      effectiveKeys: MENU_KEYS.filter((k) => effective.has(k)),
    };
  }

  return mapsFromRows(
    staff.rol,
    (roleRes.data ?? []) as Array<{ menu_key: string; allowed: boolean }>,
    (overrideRes.data ?? []) as Array<{ menu_key: string; allowed: boolean }>,
  );
}
