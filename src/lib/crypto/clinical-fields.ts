import { decryptField, encryptField } from "@/lib/crypto/aes-gcm";

export const CLINICAL_FIELD_KEYS = [
  "historial_medico",
  "alergias",
  "medicamentos",
  "diagnosticos_previos",
  "anamnesis",
  "exploracion_fisica",
  "diagnostico_fisioterapeutico",
  "objetivo_tratamiento",
] as const;

export type ClinicalFieldKey = (typeof CLINICAL_FIELD_KEYS)[number];

export type ClinicalPlaintext = Partial<Record<ClinicalFieldKey, string | null>>;
export type ClinicalCiphertext = Partial<Record<ClinicalFieldKey, string | null>>;

function encryptionKey(): string {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("FIELD_ENCRYPTION_KEY no configurada.");
  }
  return key;
}

/** Cifra campos clínicos no vacíos. */
export function encryptClinicalFields(plain: ClinicalPlaintext): ClinicalCiphertext {
  const key = encryptionKey();
  const out: ClinicalCiphertext = {};
  for (const field of CLINICAL_FIELD_KEYS) {
    const value = plain[field];
    if (value == null || value.trim() === "") {
      out[field] = value ?? null;
      continue;
    }
    out[field] = encryptField(value, key).ciphertext;
  }
  return out;
}

/** Descifra campos clínicos (ignora nulos). */
export function decryptClinicalFields(cipher: ClinicalCiphertext): ClinicalPlaintext {
  const key = encryptionKey();
  const out: ClinicalPlaintext = {};
  for (const field of CLINICAL_FIELD_KEYS) {
    const value = cipher[field];
    if (value == null || value === "") {
      out[field] = value ?? null;
      continue;
    }
    out[field] = decryptField(value, key);
  }
  return out;
}

export function encryptOptionalText(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return encryptField(value, encryptionKey()).ciphertext;
}

export function decryptOptionalText(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return decryptField(value, encryptionKey());
}
