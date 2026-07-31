import type { ThemePreference } from "@/lib/roles";

export type ColorScheme = "claro" | "oscuro";

/**
 * Precedencia (§16, test 4.10):
 * preferencia staff (si no es sistema) > tema clínica (si no es sistema) > sistema OS.
 */
export function resolveThemePreference(
  staffPref: ThemePreference | null | undefined,
  clinicDefault: ThemePreference | null | undefined,
): ThemePreference {
  if (staffPref === "claro" || staffPref === "oscuro") return staffPref;
  if (clinicDefault === "claro" || clinicDefault === "oscuro") {
    return clinicDefault;
  }
  return "sistema";
}

/** Resuelve a claro/oscuro dado el preferido efectivo y el OS. */
export function resolveColorScheme(
  preference: ThemePreference,
  systemIsDark: boolean,
): ColorScheme {
  if (preference === "claro") return "claro";
  if (preference === "oscuro") return "oscuro";
  return systemIsDark ? "oscuro" : "claro";
}

export const THEME_COOKIE = "terafis_theme";
export const SCHEME_COOKIE = "terafis_scheme";
