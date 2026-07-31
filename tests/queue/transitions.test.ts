import { describe, expect, it } from "vitest";

import {
  canQueueTransition,
  FinalizeConsultationSchema,
  QUEUE_TRANSITIONS,
} from "@/lib/queue/schemas";

describe("transiciones de cola", () => {
  it("permite flujo check-in → consulta → cobro", () => {
    expect(canQueueTransition("pendiente", "en_sala_espera")).toBe(true);
    expect(canQueueTransition("en_sala_espera", "en_consulta")).toBe(true);
    expect(canQueueTransition("en_consulta", "pendiente_pago")).toBe(true);
    expect(canQueueTransition("pendiente_pago", "completado")).toBe(true);
  });

  it("rechaza saltos inválidos", () => {
    expect(canQueueTransition("pendiente", "completado")).toBe(false);
    expect(canQueueTransition("pendiente", "pendiente_pago")).toBe(false);
    expect(QUEUE_TRANSITIONS.completado).toEqual([]);
  });
});

describe("FinalizeConsultationSchema", () => {
  it("exige al menos un servicio", () => {
    const parsed = FinalizeConsultationSchema.safeParse({
      appointmentId: "11111111-1111-4111-8111-111111111111",
      queueId: "22222222-2222-4222-8222-222222222222",
      expectedVersion: 0,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });
});
