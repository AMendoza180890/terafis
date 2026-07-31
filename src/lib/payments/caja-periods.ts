import { formatInTimeZone } from "date-fns-tz";

import {
  clinicLocalToUtcIso,
  clinicTodayIso,
  DEFAULT_TZ,
} from "@/lib/datetime/clinic-tz";

export type CajaServiceLine = {
  titulo: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
};

export type CajaPaymentRow = {
  id: string;
  appointmentId: string;
  monto: number;
  metodoPago: "cash" | "transferencia" | string;
  fechaPago: string;
  referencia: string | null;
  cambio: number | null;
  pacienteId: string;
  pacienteNombre: string;
  servicios: CajaServiceLine[];
};

export type CajaDateFilter = {
  /** YYYY-MM (mes a revisar). */
  month: string;
  /** YYYY-MM-DD opcional (inicio). */
  desde?: string;
  /** YYYY-MM-DD opcional (fin). */
  hasta?: string;
};

/** Mes civil actual en zona de la clínica (YYYY-MM). */
export function clinicCurrentMonthKey(timezone: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(), timezone || DEFAULT_TZ, "yyyy-MM");
}

/** Primer día del mes (YYYY-MM-DD). */
export function monthStartDate(monthKey: string): string {
  return `${monthKey}-01`;
}

/** Último día del mes (YYYY-MM-DD). */
export function monthEndDate(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${monthKey}-${String(last).padStart(2, "0")}`;
}

/** Inicio UTC del 1° de enero del año civil de la clínica (para cargar datos). */
export function clinicYearStartUtc(timezone: string = DEFAULT_TZ): string {
  const year = formatInTimeZone(new Date(), timezone, "yyyy");
  return clinicLocalToUtcIso(`${year}-01-01`, "00:00", timezone);
}

/**
 * Opciones de mes: año en curso hasta el mes actual (no muestra meses futuros
 * ni fuerza meses vacíos del año pasado).
 */
export function currentYearMonthOptions(timezone: string = DEFAULT_TZ): Array<{
  value: string;
  label: string;
}> {
  const year = Number(formatInTimeZone(new Date(), timezone, "yyyy"));
  const currentMonth = Number(formatInTimeZone(new Date(), timezone, "M"));
  const options: Array<{ value: string; label: string }> = [];
  for (let m = 1; m <= currentMonth; m++) {
    const value = `${year}-${String(m).padStart(2, "0")}`;
    const label = new Date(year, m - 1, 1).toLocaleDateString("es-NI", {
      month: "long",
      year: "numeric",
    });
    options.push({ value, label });
  }
  return options.reverse(); // mes actual primero
}

export function paymentLocalDate(
  fechaPagoIso: string,
  timezone: string,
): string {
  return formatInTimeZone(new Date(fechaPagoIso), timezone, "yyyy-MM-dd");
}

export function paymentLocalMonth(
  fechaPagoIso: string,
  timezone: string,
): string {
  return formatInTimeZone(new Date(fechaPagoIso), timezone, "yyyy-MM");
}

/** Filtra por mes y, opcionalmente, rango de fechas de atención/cobro. */
export function filterPaymentsByDate(
  payments: CajaPaymentRow[],
  filter: CajaDateFilter,
  timezone: string,
): CajaPaymentRow[] {
  const monthStart = monthStartDate(filter.month);
  const monthEnd = monthEndDate(filter.month);
  const desde = filter.desde && filter.desde > monthStart ? filter.desde : monthStart;
  const hasta = filter.hasta && filter.hasta < monthEnd ? filter.hasta : monthEnd;

  return payments.filter((p) => {
    const local = paymentLocalDate(p.fechaPago, timezone);
    if (paymentLocalMonth(p.fechaPago, timezone) !== filter.month) return false;
    return local >= desde && local <= hasta;
  });
}

export function sumPayments(payments: CajaPaymentRow[]): {
  total: number;
  count: number;
  cash: number;
  transferencia: number;
} {
  let total = 0;
  let cash = 0;
  let transferencia = 0;
  for (const p of payments) {
    total += p.monto;
    if (p.metodoPago === "cash") cash += p.monto;
    else if (p.metodoPago === "transferencia") transferencia += p.monto;
  }
  return { total, count: payments.length, cash, transferencia };
}

/** Días del mes con al menos un cobro (para chips de filtro rápido). */
export function attendedDatesInMonth(
  payments: CajaPaymentRow[],
  monthKey: string,
  timezone: string,
): string[] {
  const set = new Set<string>();
  for (const p of payments) {
    if (paymentLocalMonth(p.fechaPago, timezone) !== monthKey) continue;
    set.add(paymentLocalDate(p.fechaPago, timezone));
  }
  return [...set].sort().reverse();
}

export type MonthEarnings = {
  key: string;
  /** Etiqueta corta (ene, feb…). */
  shortLabel: string;
  /** Etiqueta larga (enero 2026). */
  label: string;
  total: number;
  count: number;
  cash: number;
  transferencia: number;
};

/**
 * Ganancias por mes del año en curso, orden cronológico.
 * Solo incluye meses con al menos un movimiento.
 */
export function yearMonthlyEarnings(
  payments: CajaPaymentRow[],
  timezone: string = DEFAULT_TZ,
): MonthEarnings[] {
  const year = Number(formatInTimeZone(new Date(), timezone, "yyyy"));
  const currentMonth = Number(formatInTimeZone(new Date(), timezone, "M"));
  const buckets = new Map<string, MonthEarnings>();

  function ensureBucket(key: string): MonthEarnings | null {
    const existing = buckets.get(key);
    if (existing) return existing;
    const [y, m] = key.split("-").map(Number);
    if (y !== year || !m || m < 1 || m > currentMonth) return null;
    const date = new Date(y, m - 1, 1);
    const bucket: MonthEarnings = {
      key,
      shortLabel: date
        .toLocaleDateString("es-NI", { month: "short" })
        .replace(".", ""),
      label: date.toLocaleDateString("es-NI", {
        month: "long",
        year: "numeric",
      }),
      total: 0,
      count: 0,
      cash: 0,
      transferencia: 0,
    };
    buckets.set(key, bucket);
    return bucket;
  }

  for (const p of payments) {
    const key = paymentLocalMonth(p.fechaPago, timezone);
    const bucket = ensureBucket(key);
    if (!bucket) continue;
    bucket.total += p.monto;
    bucket.count += 1;
    if (p.metodoPago === "cash") bucket.cash += p.monto;
    else if (p.metodoPago === "transferencia") bucket.transferencia += p.monto;
  }

  return [...buckets.values()]
    .filter((m) => m.count > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export { clinicTodayIso };
