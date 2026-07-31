import { describe, expect, it } from "vitest";

import {
  ReferringDoctorSchema,
  UpdateReferringDoctorSchema,
} from "@/lib/referring-doctors/schemas";
import { CreatePatientSchema } from "@/lib/patients/schemas";

describe("ReferringDoctorSchema", () => {
  it("acepta doctor con nombre y apellido", () => {
    const parsed = ReferringDoctorSchema.safeParse({
      nombre: "Carlos",
      apellido: "Méndez",
      telefono: "88881111",
      especialidad: "Traumatología",
      direccion: "Managua",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza apellido corto", () => {
    const parsed = ReferringDoctorSchema.safeParse({
      nombre: "Carlos",
      apellido: "M",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("UpdateReferringDoctorSchema", () => {
  it("requiere id", () => {
    const parsed = UpdateReferringDoctorSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      nombre: "Ana",
      apellido: "López",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("CreatePatientSchema con referido", () => {
  it("acepta referidoDoctorId opcional", () => {
    const parsed = CreatePatientSchema.safeParse({
      nombre: "María García",
      telefono: "88887777",
      referidoDoctorId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.success).toBe(true);
  });
});
