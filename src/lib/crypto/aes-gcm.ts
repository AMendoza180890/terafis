import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "v1";

export type EncryptedPayload = {
  /** Formato: v1:<iv_b64>:<tag_b64>:<ciphertext_b64> */
  ciphertext: string;
};

function decodeKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY debe ser 32 bytes en base64 (AES-256).");
  }
  return key;
}

/**
 * Cifra texto clínico con AES-256-GCM antes del INSERT (§2.1).
 * Solo ejecutar en el servidor.
 */
export function encryptField(plaintext: string, base64Key: string): EncryptedPayload {
  const key = decodeKey(base64Key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: [
      VERSION_PREFIX,
      iv.toString("base64"),
      tag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":"),
  };
}

/**
 * Descifra un campo clínico. Lanza si el tag de autenticación no coincide.
 */
export function decryptField(payload: string, base64Key: string): string {
  const key = decodeKey(base64Key);
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Formato de cifrado no reconocido.");
  }

  const [, ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Payload cifrado incompleto.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Genera una llave de 32 bytes en base64 (para rotación / bootstrap). */
export function generateFieldEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}
