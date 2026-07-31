import { describe, expect, it } from "vitest";

import {
  computeReminderWindows,
  filterByOptIn,
  nextBackoffMs,
  REMINDER_OFFSETS,
} from "@/lib/notifications/reminders";

describe("ventanas de recordatorio", () => {
  it("calcula 24h / 2h / 30min en UTC", () => {
    // Cita: 2026-08-02 15:00 UTC (= 09:00 America/Managua)
    const start = new Date("2026-08-02T15:00:00.000Z");
    const now = new Date("2026-07-31T12:00:00.000Z");
    const windows = computeReminderWindows(start, now);

    expect(windows).toHaveLength(3);
    const email = windows.find((w) => w.canal === "email");
    const sms = windows.find((w) => w.canal === "sms");
    const push = windows.find((w) => w.canal === "push");

    expect(email?.sendAt.toISOString()).toBe(
      new Date(start.getTime() - REMINDER_OFFSETS.email24h).toISOString(),
    );
    expect(sms?.sendAt.toISOString()).toBe(
      new Date(start.getTime() - REMINDER_OFFSETS.sms2h).toISOString(),
    );
    expect(push?.sendAt.toISOString()).toBe(
      new Date(start.getTime() - REMINDER_OFFSETS.push30m).toISOString(),
    );
  });

  it("omite ventanas ya pasadas si se agenda con poca antelación", () => {
    const start = new Date("2026-08-01T16:00:00.000Z");
    const now = new Date("2026-08-01T15:00:00.000Z"); // 1h antes
    const windows = computeReminderWindows(start, now);
    expect(windows.every((w) => w.canal === "push")).toBe(true);
    expect(windows).toHaveLength(1);
  });

  it("respeta opt-in: sin SMS no encola SMS", () => {
    const start = new Date("2026-08-10T15:00:00.000Z");
    const windows = computeReminderWindows(start, new Date("2026-08-01T00:00:00.000Z"));
    const filtered = filterByOptIn(
      windows,
      { email: true, sms: false, whatsapp: false, push: false },
      { email24h: true, sms2h: true, push30m: true },
    );
    expect(filtered.map((w) => w.canal)).toEqual(["email"]);
  });

  it("backoff exponencial con tope", () => {
    expect(nextBackoffMs(1)).toBe(60_000);
    expect(nextBackoffMs(2)).toBe(120_000);
    expect(nextBackoffMs(20)).toBe(3_600_000);
  });
});
