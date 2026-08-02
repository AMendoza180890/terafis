import { redirect } from "next/navigation";

import type { CurrentStaff } from "@/lib/auth/current-staff";
import type { MenuKey } from "@/lib/permissions/menu-catalog";
import { getEffectiveMenuAccessForStaff } from "@/lib/permissions/resolve";

/**
 * Autorización server-side real para páginas bajo /app/**.
 * MenuAccessGate es solo UI; esto es la barrera que importa.
 *
 * Si staff es null (modo local/dev sin Supabase configurado, ya permitido
 * por el layout), no bloquea — mantiene el flujo de desarrollo sin auth.
 */
export async function requireMenuAccess(
  staff: CurrentStaff | null,
  key: MenuKey,
): Promise<void> {
  if (!staff) return;
  const { effectiveKeys } = await getEffectiveMenuAccessForStaff(staff);
  if (!effectiveKeys.includes(key)) {
    redirect("/app");
  }
}

/** Autorización real para server actions: no redirige, solo informa. */
export async function hasMenuAccess(staff: CurrentStaff, key: MenuKey): Promise<boolean> {
  const { effectiveKeys } = await getEffectiveMenuAccessForStaff(staff);
  return effectiveKeys.includes(key);
}
