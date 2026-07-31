import { describe, expect, it } from "vitest";

import {
  CreatePatientSchema,
  SearchPatientsSchema,
  UpdatePatientContactSchema,
} from "@/lib/patients/schemas";

describe("CreatePatientSchema", () => {
  it("acepta contacto mínimo", () => {
    const parsed = CreatePatientSchema.safeParse({
      nombre: "María García",
      telefono: "88887777",
      optInEmail: true,
      optInSms: false,
      optInWhatsapp: false,
      optInPush: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza teléfono corto", () => {
    const parsed = CreatePatientSchema.safeParse({
      nombre: "Ana",
      telefono: "123",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("UpdatePatientContactSchema", () => {
  it("requiere patientId uuid", () => {
    const parsed = UpdatePatientContactSchema.safeParse({
      patientId: "11111111-1111-4111-8111-111111111111",
      nombre: "María García",
      telefono: "88887777",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("SearchPatientsSchema", () => {
  it("acepta término de búsqueda", () => {
    const parsed = SearchPatientsSchema.safeParse({ q: "María" });
    expect(parsed.success).toBe(true);
  });
});
