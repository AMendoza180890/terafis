/** Versión pública del sistema Terafis. */
export const APP_VERSION = "1.0";

export const APP_NAME = "Terafis";

export const COPYRIGHT_START_YEAR = 2026;

export const DEVELOPER = {
  name: "Allan Mendoza",
  url: "https://allanmendoza.tech/",
} as const;

/** Rango de derechos: 2026 o 2026–YYYY si el año actual es posterior. */
export function copyrightYears(now = new Date()): string {
  const year = now.getFullYear();
  if (year <= COPYRIGHT_START_YEAR) return String(COPYRIGHT_START_YEAR);
  return `${COPYRIGHT_START_YEAR}–${year}`;
}
