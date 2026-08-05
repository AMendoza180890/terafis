"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { ThemePreferenceSchema } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  resolveColorScheme,
  resolveThemePreference,
  SCHEME_COOKIE,
  THEME_COOKIE,
} from "@/lib/theme/resolution";

export type ThemeActionResult = { ok: true } | { ok: false; error: string };

export async function setStaffThemeAction(raw: unknown): Promise<ThemeActionResult> {
  const parsed = ThemePreferenceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Tema inválido" };
  }

  const staff = await requireCurrentStaff();
  const supabase = await createClient();

  const { data: cfg } = await supabase
    .from("clinic_config")
    .select("tema_defecto")
    .eq("clinic_id", staff.clinicId)
    .maybeSingle();

  const clinicDefault =
    (cfg as { tema_defecto?: "claro" | "oscuro" | "sistema" } | null)?.tema_defecto ??
    "sistema";

  const { error } = await supabase
    .from("staff")
    .update({
      tema_preferido: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.id);

  if (error) return { ok: false, error: error.message };

  const jar = await cookies();
  jar.set(THEME_COOKIE, parsed.data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const effective = resolveThemePreference(parsed.data, clinicDefault);
  // Para SSR: si es sistema, dejar scheme a cargo del script; si no, fijarlo.
  if (effective === "claro" || effective === "oscuro") {
    jar.set(SCHEME_COOKIE, effective, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    jar.set(SCHEME_COOKIE, "", { path: "/", maxAge: 0 });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Actualiza solo la cookie de esquema resuelto (cliente, sin flash). */
export async function syncResolvedSchemeAction(systemIsDark: boolean): Promise<void> {
  const jar = await cookies();
  const theme =
    (jar.get(THEME_COOKIE)?.value as "claro" | "oscuro" | "sistema" | undefined) ??
    "sistema";
  const scheme = resolveColorScheme(theme, systemIsDark);
  jar.set(SCHEME_COOKIE, scheme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
