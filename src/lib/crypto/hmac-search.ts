import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Hash determinístico HMAC-SHA256 para búsqueda por igualdad exacta (§2.1).
 * Nunca indexar texto clínico en claro.
 */
export function hmacSearchToken(value: string, base64Key: string): string {
  const key = Buffer.from(base64Key, "base64");
  if (key.length < 16) {
    throw new Error("SEARCH_HMAC_KEY demasiado corta.");
  }
  const normalized = value.trim().toLowerCase();
  return createHmac("sha256", key).update(normalized, "utf8").digest("hex");
}

export function hmacSearchEquals(a: string, b: string, base64Key: string): boolean {
  const ha = Buffer.from(hmacSearchToken(a, base64Key), "hex");
  const hb = Buffer.from(hmacSearchToken(b, base64Key), "hex");
  if (ha.length !== hb.length) return false;
  return timingSafeEqual(ha, hb);
}
