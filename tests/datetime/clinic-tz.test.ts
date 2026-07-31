import { describe, expect, it } from "vitest";

import {
  addMinutesIso,
  clinicLocalToUtcIso,
  formatInClinicTz,
} from "@/lib/datetime/clinic-tz";

describe("zona horaria de clínica", () => {
  it("convierte hora local America/Managua a UTC", () => {
    // Managua es UTC-6 sin DST
    const iso = clinicLocalToUtcIso("2026-08-01", "09:00", "America/Managua");
    expect(iso).toBe("2026-08-01T15:00:00.000Z");
  });

  it("suma duración en UTC", () => {
    const inicio = "2026-08-01T15:00:00.000Z";
    expect(addMinutesIso(inicio, 60)).toBe("2026-08-01T16:00:00.000Z");
  });

  it("formatea para UI local", () => {
    const label = formatInClinicTz(
      "2026-08-01T15:00:00.000Z",
      "America/Managua",
      "yyyy-MM-dd HH:mm",
    );
    expect(label).toBe("2026-08-01 09:00");
  });
});
