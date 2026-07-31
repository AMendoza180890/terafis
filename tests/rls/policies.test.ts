/**
 * Pruebas de políticas RLS (§2.2, §18).
 *
 * Requieren un proyecto Supabase local (`pnpm supabase:start`) y usuarios
 * de prueba por rol. Se ejecutan en CI cuando exista contenedor Postgres
 * con la migración aplicada.
 *
 * Casos obligatorios (un caso por rol):
 * 1. admin — ve staff, clinic_config y audit_log de su clinic_id; no ve otras clínicas.
 * 2. terapeuta — ve staff de su clínica; NO ve audit_log; (Fase 1+) solo pacientes asignados.
 * 3. recepcionista — ve staff; NO ve audit_log; ve expediente clínico (patient_clinical).
 *
 * Mientras no haya BD local en CI, este archivo documenta el contrato.
 * Las aserciones de roles en capa de aplicación están en tests/roles.
 */

import { describe, expect, it } from "vitest";

import { RoleCapabilities } from "@/lib/roles";

describe("contrato RLS (documentación ejecutable)", () => {
  it("matriz de capacidades coincide con políticas previstas", () => {
    expect(RoleCapabilities.admin.verAuditLog).toBe(true);
    expect(RoleCapabilities.terapeuta.verAuditLog).toBe(false);
    expect(RoleCapabilities.recepcionista.verExpedienteClinico).toBe(true);
  });

  it.todo("admin solo lee audit_log de su clinic_id (Supabase local)");
  it.todo("terapeuta no puede SELECT audit_log");
  it.todo("recepcionista puede SELECT/UPDATE patient_clinical");
  it.todo("terapeuta solo ve patient_clinical de pacientes con cita asignada");
  it.todo("EXCLUDE no_solapamiento_terapeuta rechaza traslape en BD");
  it.todo("FORCE RLS impide bypass incluso como table owner en tests");
});
