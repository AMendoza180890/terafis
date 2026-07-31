import { describe, expect, it } from "vitest";

import { assertNoClinicalPayload } from "@/lib/notifications/privacy";

describe("privacidad de payloads", () => {
  it("permite payload administrativo", () => {
    const payload = assertNoClinicalPayload({
      appointment_id: "x",
      confirm_url: "https://example.com",
      clinic_nombre: "Terafis",
    });
    expect(payload.clinic_nombre).toBe("Terafis");
  });

  it("rechaza claves clínicas", () => {
    expect(() => assertNoClinicalPayload({ diagnostico: "lumbalgia" })).toThrow(
      /clínico/,
    );
    expect(() => assertNoClinicalPayload({ notas_evolucion: "dolor" })).toThrow(
      /clínico/,
    );
  });
});
