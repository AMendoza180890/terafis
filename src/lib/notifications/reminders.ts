/**
 * Ventanas de recordatorio calculadas en UTC a partir del inicio de la cita.
 * La zona IANA de la clínica se usa al interpretar la hora local al crear la cita;
 * aquí trabajamos solo con el instante UTC ya materializado.
 */

export type ReminderWindow = {
  canal: "email" | "sms" | "whatsapp" | "push";
  plantilla: string;
  offsetMs: number;
  /** Momento UTC en que debe enviarse. */
  sendAt: Date;
};

const H = 60 * 60 * 1000;
const M = 60 * 1000;

export const REMINDER_OFFSETS = {
  email24h: 24 * H,
  sms2h: 2 * H,
  push30m: 30 * M,
} as const;

export function computeReminderWindows(
  appointmentStartUtc: Date,
  now: Date = new Date(),
): ReminderWindow[] {
  const start = appointmentStartUtc.getTime();
  const windows: ReminderWindow[] = [
    {
      canal: "email",
      plantilla: "recordatorio_24h",
      offsetMs: REMINDER_OFFSETS.email24h,
      sendAt: new Date(start - REMINDER_OFFSETS.email24h),
    },
    {
      canal: "sms",
      plantilla: "recordatorio_2h",
      offsetMs: REMINDER_OFFSETS.sms2h,
      sendAt: new Date(start - REMINDER_OFFSETS.sms2h),
    },
    {
      canal: "push",
      plantilla: "recordatorio_30m",
      offsetMs: REMINDER_OFFSETS.push30m,
      sendAt: new Date(start - REMINDER_OFFSETS.push30m),
    },
  ];

  // Solo encolar ventanas futuras (si se agenda con menos de 24h, omitir las pasadas)
  return windows.filter((w) => w.sendAt.getTime() > now.getTime());
}

/** Backoff exponencial: 1m, 2m, 4m, 8m… tope 1h. */
export function nextBackoffMs(intentos: number): number {
  const base = 60_000;
  const ms = base * 2 ** Math.max(0, intentos - 1);
  return Math.min(ms, 60 * 60_000);
}

export type OptInChannels = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
};

export function filterByOptIn(
  windows: ReminderWindow[],
  optIn: OptInChannels,
  clinicFlags: { email24h: boolean; sms2h: boolean; push30m: boolean },
): ReminderWindow[] {
  return windows.filter((w) => {
    if (w.canal === "email") return clinicFlags.email24h && optIn.email;
    if (w.canal === "sms" || w.canal === "whatsapp") {
      return clinicFlags.sms2h && (optIn.sms || optIn.whatsapp);
    }
    if (w.canal === "push") return clinicFlags.push30m && optIn.push;
    return false;
  });
}
