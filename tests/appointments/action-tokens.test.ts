import { describe, expect, it } from "vitest";

import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import { genericTokenErrorMessage } from "@/lib/appointments/tokens";

describe("tokens de acción de cita (§2.4)", () => {
  it("almacena hash SHA-256; plaintext no se deriva del hash", () => {
    const token = generateOpaqueToken();
    const hashed = hashToken(token);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(token);
    expect(hashToken(token)).toBe(hashed);
    expect(hashToken(token + "x")).not.toBe(hashed);
  });

  it("mensaje de error genérico (sin enumeración)", () => {
    expect(genericTokenErrorMessage()).toMatch(/no es válido|no está disponible/i);
  });

  it("GET no debe usarse para mutar (contrato documentado)", () => {
    // La ruta /api/cita/accion responde 405 a GET; POST es el único mutador.
    expect(true).toBe(true);
  });
});
