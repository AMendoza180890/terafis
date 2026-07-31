import { describe, expect, it } from "vitest";

import {
  CreateTreatmentPlanSchema,
  NewPlanVersionSchema,
} from "@/lib/treatment-plans/schemas";

describe("versionado de planes", () => {
  it("valida creación de plan", () => {
    const parsed = CreateTreatmentPlanSchema.safeParse({
      patientId: "11111111-1111-4111-8111-111111111111",
      diagnostico: "Lumbalgia mecánica",
      objetivo: "Reducir EVA < 3",
      frecuencia: "2x/semana",
      exercises: [{ nombre: "Puente", series: 3, repeticiones: 12 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("nueva versión requiere planId y campos clínicos", () => {
    const parsed = NewPlanVersionSchema.safeParse({
      planId: "11111111-1111-4111-8111-111111111111",
      diagnostico: "Evolución favorable",
      objetivo: "Mantener ROM",
      frecuencia: "1x/semana",
    });
    expect(parsed.success).toBe(true);
  });
});
