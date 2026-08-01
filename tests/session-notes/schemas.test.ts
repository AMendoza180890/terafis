import { describe, expect, it } from "vitest";

import { AddPatientToAttendSchema } from "@/lib/queue/schemas";
import {
  CreateSessionNoteSchema,
  ListSessionNotesFilterSchema,
  UpdateSessionNoteSchema,
} from "@/lib/session-notes/schemas";
import { RoleCapabilities } from "@/lib/roles";

const patientId = "11111111-1111-4111-8111-111111111111";
const clinicalId = "22222222-2222-4222-8222-222222222222";

const planFields = {
  diagnostico: "Lumbalgia mecánica",
  objetivo: "Reducir EVA < 3",
  frecuencia: "2x/semana",
  ejerciciosDetalle: "Puente — 3 series × 12 repeticiones",
};

describe("CreateSessionNoteSchema", () => {
  it("acepta seguimiento con plan de tratamiento", () => {
    const parsed = CreateSessionNoteSchema.safeParse({
      patientId,
      clinicalId,
      ...planFields,
      notasEvolucion: "Mejora de movilidad",
      tratamiento: "Ultrasonido 10 min",
      observaciones: "Toleró bien",
    });
    expect(parsed.success).toBe(true);
  });

  it("acepta seguimiento sin plan de tratamiento", () => {
    const parsed = CreateSessionNoteSchema.safeParse({
      patientId,
      clinicalId,
      notasEvolucion: "Sin plan",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza plan incompleto si se empezó a llenar", () => {
    const parsed = CreateSessionNoteSchema.safeParse({
      patientId,
      clinicalId,
      diagnostico: "Solo diagnóstico",
    });
    expect(parsed.success).toBe(false);
  });

  it("acepta EVA vacío como undefined", () => {
    const parsed = CreateSessionNoteSchema.safeParse({
      patientId,
      clinicalId,
      dolorEva: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.dolorEva).toBeUndefined();
  });

  it("rechaza EVA fuera de rango", () => {
    const parsed = CreateSessionNoteSchema.safeParse({
      patientId,
      clinicalId,
      dolorEva: 12,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("UpdateSessionNoteSchema", () => {
  it("exige noteId y permite editar sin reenviar plan", () => {
    const parsed = UpdateSessionNoteSchema.safeParse({
      noteId: "33333333-3333-4333-8333-333333333333",
      patientId,
      clinicalId,
      notasEvolucion: "Actualizado",
      tratamiento: "TENS",
      observaciones: "OK",
      rangoMovimiento: "90°",
      dolorEva: 3,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza sin noteId", () => {
    const parsed = UpdateSessionNoteSchema.safeParse({
      patientId,
      clinicalId,
      notasEvolucion: "Sin id",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("ListSessionNotesFilterSchema", () => {
  it("acepta filtro por fechas y atención", () => {
    const parsed = ListSessionNotesFilterSchema.safeParse({
      patientId,
      desde: "2026-07-01",
      hasta: "2026-07-30",
      atencion: "none",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("AddPatientToAttendSchema", () => {
  it("acepta paciente + terapeuta", () => {
    const parsed = AddPatientToAttendSchema.safeParse({
      patientId,
      terapeutaId: "22222222-2222-4222-8222-222222222222",
      timezone: "America/Managua",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.duracionMinutos).toBe(60);
  });
});

describe("capacidades recepción vs terapeuta (flujos)", () => {
  it("recepción ve expediente y pagos; opera citas/cola", () => {
    expect(RoleCapabilities.recepcionista.verExpedienteClinico).toBe(true);
    expect(RoleCapabilities.recepcionista.verPagos).toBe(true);
    expect(RoleCapabilities.recepcionista.asignarCitasYCola).toBe(true);
  });

  it("terapeuta ve clínico y no pagos", () => {
    expect(RoleCapabilities.terapeuta.verExpedienteClinico).toBe(true);
    expect(RoleCapabilities.terapeuta.verPagos).toBe(false);
    expect(RoleCapabilities.terapeuta.asignarCitasYCola).toBe(false);
  });
});
