import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DEFAULT_TZ = "America/Managua";

/** Presenta un instante UTC en la zona de la clínica. */
export function formatInClinicTz(
  utcDate: Date | string,
  timezone: string,
  pattern = "dd/MM/yyyy HH:mm",
): string {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return formatInTimeZone(date, timezone || DEFAULT_TZ, pattern);
}

/**
 * Interpreta fecha+hora local de la clínica y devuelve ISO UTC.
 * `localDate` = YYYY-MM-DD, `localTime` = HH:mm
 */
export function clinicLocalToUtcIso(
  localDate: string,
  localTime: string,
  timezone: string,
): string {
  const wall = `${localDate}T${localTime}:00`;
  return fromZonedTime(wall, timezone || DEFAULT_TZ).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}

/** Fecha civil de la clínica (YYYY-MM-DD). No usar UTC del servidor. */
export function clinicTodayIso(timezone: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(), timezone || DEFAULT_TZ, "yyyy-MM-dd");
}

export { DEFAULT_TZ };
