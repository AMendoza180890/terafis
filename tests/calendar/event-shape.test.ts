import { describe, expect, it } from "vitest";

import {
  buildAddToGoogleCalendarUrl,
  buildStaffCalendarEventPayload,
  formatGCalUtc,
} from "@/lib/calendar/patient-link";
import { assertNoClinicalPayload } from "@/lib/notifications/privacy";

describe("Google Calendar", () => {
  it("link paciente sin motivo clínico", () => {
    const url = buildAddToGoogleCalendarUrl({
      clinicNombre: "Terafis",
      inicioUtc: new Date("2026-07-30T15:00:00.000Z"),
      finUtc: new Date("2026-07-30T16:00:00.000Z"),
      ubicacion: "Calle 1",
    });
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("Fisioterapia+-+Terafis");
    expect(url).toContain("Confirmaci");
    expect(url).not.toMatch(/lumbalgia|diagn/i);
    expect(formatGCalUtc(new Date("2026-07-30T15:00:00.000Z"))).toBe("20260730T150000Z");
  });

  it("evento staff best-effort sin info clínica", () => {
    const payload = buildStaffCalendarEventPayload({
      terapeutaNombre: "Dra. López",
      pacienteNombre: "Juan Pérez",
      tipoServicio: "Evaluación",
      appointmentId: "11111111-1111-4111-8111-111111111111",
      salaNombre: "Sala 2",
      notasAdmin: "Llegar 10 min antes",
      inicioUtc: "2026-07-30T15:00:00.000Z",
      finUtc: "2026-07-30T16:00:00.000Z",
    });
    expect(assertNoClinicalPayload(payload)).toBeTruthy();
    expect(String(payload.summary)).toContain("Juan Pérez");
    expect(String(payload.description)).toContain("#11111111");
    expect(JSON.stringify(payload)).not.toMatch(/diagnostico|alergia/i);
  });
});
