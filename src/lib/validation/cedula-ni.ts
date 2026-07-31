/** Cédula de identidad de Nicaragua: 000-000000-0000A */

export const CEDULA_NI_PATTERN = /^\d{3}-\d{6}-\d{4}[A-Z]$/;

export const CEDULA_NI_PLACEHOLDER = "000-000000-0000A";

export const CEDULA_NI_LENGTH = 16;

/**
 * Aplica la máscara 000-000000-0000A mientras se escribe.
 * Solo dígitos en las posiciones numéricas; la última posición es letra A–Z.
 */
export function formatCedulaNiInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  let digits = "";
  let letter = "";

  for (const ch of cleaned) {
    if (digits.length < 13 && /\d/.test(ch)) {
      digits += ch;
    } else if (digits.length >= 13 && letter.length < 1 && /[A-Z]/.test(ch)) {
      letter = ch;
      break;
    }
  }

  const d = digits.slice(0, 13);
  let out = "";
  if (d.length > 0) out += d.slice(0, 3);
  if (d.length > 3) out += `-${d.slice(3, 9)}`;
  if (d.length > 9) out += `-${d.slice(9, 13)}`;
  if (letter) out += letter;
  return out;
}

export function isValidCedulaNi(value: string): boolean {
  return CEDULA_NI_PATTERN.test(value.trim().toUpperCase());
}
