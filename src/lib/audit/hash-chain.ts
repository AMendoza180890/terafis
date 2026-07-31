import { createHash } from "node:crypto";

export type AuditEntryInput = {
  clinicId: string;
  actorId: string | null;
  rol: string | null;
  accion: string;
  tabla: string | null;
  registroId: string | null;
  ip: string | null;
  userAgent: string | null;
  /** Diff sin contenido clínico en claro. */
  diff: Record<string, unknown> | null;
  createdAt: string;
};

const GENESIS_HASH = "0".repeat(64);

/**
 * Encadenamiento por hash para detectar manipulación del audit_log (§2.6).
 */
export function computeAuditHash(entry: AuditEntryInput, hashAnterior: string): string {
  const canonical = JSON.stringify({
    clinicId: entry.clinicId,
    actorId: entry.actorId,
    rol: entry.rol,
    accion: entry.accion,
    tabla: entry.tabla,
    registroId: entry.registroId,
    ip: entry.ip,
    userAgent: entry.userAgent,
    diff: entry.diff,
    createdAt: entry.createdAt,
    hashAnterior,
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function genesisHash(): string {
  return GENESIS_HASH;
}

export function verifyAuditChain(
  rows: Array<{
    entry: AuditEntryInput;
    hashAnterior: string;
    hashActual: string;
  }>,
): boolean {
  let expectedPrev = GENESIS_HASH;
  for (const row of rows) {
    if (row.hashAnterior !== expectedPrev) return false;
    const computed = computeAuditHash(row.entry, row.hashAnterior);
    if (computed !== row.hashActual) return false;
    expectedPrev = row.hashActual;
  }
  return true;
}
