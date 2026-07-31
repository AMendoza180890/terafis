import { describe, expect, it } from "vitest";

import {
  computeAuditHash,
  genesisHash,
  verifyAuditChain,
  type AuditEntryInput,
} from "@/lib/audit/hash-chain";

function sample(overrides: Partial<AuditEntryInput> = {}): AuditEntryInput {
  return {
    clinicId: "11111111-1111-1111-1111-111111111111",
    actorId: "22222222-2222-2222-2222-222222222222",
    rol: "admin",
    accion: "clinical_record.read",
    tabla: "clinical_records",
    registroId: "33333333-3333-3333-3333-333333333333",
    ip: "127.0.0.1",
    userAgent: "vitest",
    diff: { fields: ["diagnostico"] },
    createdAt: "2026-07-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("cadena de hash de audit_log", () => {
  it("encadena entradas y verifica integridad", () => {
    const e1 = sample();
    const h1 = computeAuditHash(e1, genesisHash());
    const e2 = sample({
      accion: "patient.update",
      createdAt: "2026-07-30T12:01:00.000Z",
    });
    const h2 = computeAuditHash(e2, h1);

    expect(
      verifyAuditChain([
        { entry: e1, hashAnterior: genesisHash(), hashActual: h1 },
        { entry: e2, hashAnterior: h1, hashActual: h2 },
      ]),
    ).toBe(true);
  });

  it("detecta manipulación", () => {
    const e1 = sample();
    const h1 = computeAuditHash(e1, genesisHash());
    const tampered = sample({ accion: "hacked" });

    expect(
      verifyAuditChain([
        { entry: tampered, hashAnterior: genesisHash(), hashActual: h1 },
      ]),
    ).toBe(false);
  });
});
