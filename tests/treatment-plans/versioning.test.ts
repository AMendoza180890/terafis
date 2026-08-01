import { describe, expect, it } from "vitest";

import {
  CreateTreatmentPlanSchema,
  exercisesToDetalle,
  NewPlanVersionSchema,
} from "@/lib/treatment-plans/schemas";

describe("versionado de planes", () => {
  it("valida creación de plan con ejerciciosDetalle", () => {
    const parsed = CreateTreatmentPlanSchema.safeParse({
      patientId: "11111111-1111-4111-8111-111111111111",
      diagnostico: "Lumbalgia mecánica",
      objetivo: "Reducir EVA < 3",
      frecuencia: "2x/semana",
      ejerciciosDetalle:
        "Puente de glúteos — 3 series × 12 repeticiones\nBird-dog — 3 × 10",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza plan sin ejercicios", () => {
    const parsed = CreateTreatmentPlanSchema.safeParse({
      patientId: "11111111-1111-4111-8111-111111111111",
      diagnostico: "Lumbalgia mecánica",
      objetivo: "Reducir EVA < 3",
      frecuencia: "2x/semana",
      ejerciciosDetalle: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("nueva versión requiere planId y campos clínicos", () => {
    const parsed = NewPlanVersionSchema.safeParse({
      planId: "11111111-1111-4111-8111-111111111111",
      diagnostico: "Evolución favorable",
      objetivo: "Mantener ROM",
      frecuencia: "1x/semana",
      ejerciciosDetalle: "Equilibrio unipodal — 3 × 30 s",
    });
    expect(parsed.success).toBe(true);
  });

  it("reconstruye detalle desde filas legadas", () => {
    expect(
      exercisesToDetalle([
        { nombre: "Puente", series: 3, repeticiones: 12, descripcion: null },
      ]),
    ).toContain("3 series");
  });
});
