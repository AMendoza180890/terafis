import { describe, expect, it } from "vitest";

import {
  decryptField,
  encryptField,
  generateFieldEncryptionKey,
} from "@/lib/crypto/aes-gcm";

describe("AES-256-GCM cifrado de campos clínicos", () => {
  it("cifra y descifra texto", () => {
    const key = generateFieldEncryptionKey();
    const plain = "Alergia a penicilina; antecedente de lumbalgia.";
    const { ciphertext } = encryptField(plain, key);
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(ciphertext).not.toContain("penicilina");
    expect(decryptField(ciphertext, key)).toBe(plain);
  });

  it("rechaza llave de tamaño incorrecto", () => {
    expect(() => encryptField("x", Buffer.from("corta").toString("base64"))).toThrow(
      /32 bytes/,
    );
  });

  it("falla si se altera el ciphertext", () => {
    const key = generateFieldEncryptionKey();
    const { ciphertext } = encryptField("dato sensible", key);
    const parts = ciphertext.split(":");
    parts[3] = Buffer.from("basura").toString("base64");
    expect(() => decryptField(parts.join(":"), key)).toThrow();
  });
});
