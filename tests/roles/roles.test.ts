import { describe, expect, it } from "vitest";

import { RoleCapabilities, inactivityMinutesForRole, requiresMfa } from "@/lib/roles";

describe("roles y políticas de sesión", () => {
  it("MFA obligatorio para admin y terapeuta", () => {
    expect(requiresMfa("admin")).toBe(true);
    expect(requiresMfa("terapeuta")).toBe(true);
    expect(requiresMfa("recepcionista")).toBe(false);
  });

  it("timeouts de inactividad por rol", () => {
    expect(inactivityMinutesForRole("recepcionista")).toBe(15);
    expect(inactivityMinutesForRole("admin")).toBe(30);
    expect(inactivityMinutesForRole("terapeuta")).toBe(30);
  });

  it("recepcionista ve expediente clínico, no audit log", () => {
    expect(RoleCapabilities.recepcionista.verExpedienteClinico).toBe(true);
    expect(RoleCapabilities.recepcionista.verAuditLog).toBe(false);
    expect(RoleCapabilities.recepcionista.verPagos).toBe(true);
    expect(RoleCapabilities.terapeuta.verPagos).toBe(false);
  });

  it("matriz para flujos recepción vs fisio (nav)", () => {
    // Recepción: cola/caja/expediente sí
    expect(RoleCapabilities.recepcionista.verPagos).toBe(true);
    expect(RoleCapabilities.recepcionista.verExpedienteClinico).toBe(true);
    // Fisio: clínico sí; caja/reportes no
    expect(RoleCapabilities.terapeuta.verExpedienteClinico).toBe(true);
    expect(RoleCapabilities.terapeuta.verPagos).toBe(false);
    expect(RoleCapabilities.terapeuta.gestionarStaff).toBe(false);
  });

  it("solo recepción/admin asigna citas y opera la cola", () => {
    expect(RoleCapabilities.recepcionista.asignarCitasYCola).toBe(true);
    expect(RoleCapabilities.admin.asignarCitasYCola).toBe(true);
    expect(RoleCapabilities.terapeuta.asignarCitasYCola).toBe(false);
  });
});
