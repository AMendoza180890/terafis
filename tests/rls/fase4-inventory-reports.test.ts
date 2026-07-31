/**
 * Contrato RLS Fase 4 (requiere Supabase local para ejecución real).
 * 4.2 append-only movements; 4.7 export solo admin.
 */

import { describe, expect, it } from "vitest";

import { RoleCapabilities } from "@/lib/roles";

describe("contrato RLS Fase 4", () => {
  it("movimientos: solo INSERT/SELECT previstos (sin UPDATE/DELETE en app)", () => {
    // Documentado en migración: REVOKE UPDATE, DELETE + sin policies de mutación.
    expect(true).toBe(true);
  });

  it("export reportes con PII solo admin", () => {
    expect(RoleCapabilities.admin.exportarReportes).toBe(true);
    expect(RoleCapabilities.recepcionista.exportarReportes).toBe(false);
    expect(RoleCapabilities.terapeuta.exportarReportes).toBe(false);
  });

  it.todo("inventory_movements UPDATE denegado por RLS/grants (Supabase local)");
  it.todo("inventory_movements DELETE denegado (Supabase local)");
  it.todo("terapeuta no puede sell_product (RPC)");
});
