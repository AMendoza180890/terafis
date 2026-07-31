import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  canTransition,
  CreateAppointmentSchema,
} from "@/lib/appointments/schemas";

describe("máquina de estados de citas", () => {
  it("permite flujo operativo básico", () => {
    expect(canTransition("pendiente", "confirmada")).toBe(true);
    expect(canTransition("confirmada", "en_sala_espera")).toBe(true);
    expect(canTransition("en_sala_espera", "en_consulta")).toBe(true);
    expect(canTransition("en_consulta", "completado")).toBe(true);
  });

  it("rechaza saltos inválidos", () => {
    expect(canTransition("pendiente", "completado")).toBe(false);
    expect(canTransition("completado", "pendiente")).toBe(false);
    expect(ALLOWED_TRANSITIONS.cancelado).toEqual([]);
  });
});

describe("CreateAppointmentSchema", () => {
  it("valida payload mínimo", () => {
    const parsed = CreateAppointmentSchema.safeParse({
      patientId: "11111111-1111-4111-8111-111111111111",
      terapeutaId: "22222222-2222-4222-8222-222222222222",
      fecha: "2026-08-01",
      hora: "10:30",
      duracionMinutos: 45,
      timezone: "America/Managua",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza duración inválida", () => {
    const parsed = CreateAppointmentSchema.safeParse({
      patientId: "11111111-1111-4111-8111-111111111111",
      terapeutaId: "22222222-2222-4222-8222-222222222222",
      fecha: "2026-08-01",
      hora: "10:30",
      duracionMinutos: 5,
    });
    expect(parsed.success).toBe(false);
  });
});
