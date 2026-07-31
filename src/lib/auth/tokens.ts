import { createHash, randomBytes } from "node:crypto";

/** Hash SHA-256 de refresh token / token opaco (§2.4, §2.5). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Token opaco aleatorio de 32 bytes (hex). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}
