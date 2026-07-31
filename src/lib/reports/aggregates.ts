/**
 * Agregados disociados para reportes (§13).
 * No incluyen nombres de pacientes ni diagnósticos.
 */

import { addCents, toCents, type Cents } from "@/lib/money/cents";

export type PaymentAggRow = {
  monto: string | number;
  metodo_pago: string;
  estado: string;
  cajero_id: string | null;
  fecha_pago: string | null;
};

export type AppointmentAggRow = {
  estado: string;
  terapeuta_id: string;
  inicio: string;
};

/** Suma de pagos `pagado` en centavos (coincide con corte de caja). */
export function revenueCents(payments: PaymentAggRow[]): Cents {
  return payments
    .filter((p) => p.estado === "pagado")
    .reduce((acc, p) => addCents(acc, toCents(p.monto)), 0 as Cents);
}

export function revenueByMethod(
  payments: PaymentAggRow[],
): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const p of payments) {
    if (p.estado !== "pagado") continue;
    const key = p.metodo_pago;
    out[key] = addCents(out[key] ?? (0 as Cents), toCents(p.monto));
  }
  return out;
}

export function cashCutByCashier(
  payments: PaymentAggRow[],
): Array<{ cajeroId: string; totalCents: Cents; count: number }> {
  const map = new Map<string, { totalCents: Cents; count: number }>();
  for (const p of payments) {
    if (p.estado !== "pagado" || !p.cajero_id) continue;
    const cur = map.get(p.cajero_id) ?? { totalCents: 0 as Cents, count: 0 };
    cur.totalCents = addCents(cur.totalCents, toCents(p.monto));
    cur.count += 1;
    map.set(p.cajero_id, cur);
  }
  return [...map.entries()].map(([cajeroId, v]) => ({ cajeroId, ...v }));
}

/**
 * Tasa de ausentismo = no_asistio / citas del periodo.
 * Denominador: todas las citas con inicio en el periodo (incluye canceladas).
 * Definición documentada para test 4.6.
 */
export function absenteeismRate(appointments: AppointmentAggRow[]): {
  noAsistio: number;
  total: number;
  rate: number;
} {
  const total = appointments.length;
  const noAsistio = appointments.filter((a) => a.estado === "no_asistio").length;
  return {
    noAsistio,
    total,
    rate: total === 0 ? 0 : noAsistio / total,
  };
}

export function sessionsByTherapist(
  appointments: AppointmentAggRow[],
): Array<{ terapeutaId: string; sesiones: number }> {
  const map = new Map<string, number>();
  for (const a of appointments) {
    if (!["completado", "pendiente_pago"].includes(a.estado)) continue;
    map.set(a.terapeuta_id, (map.get(a.terapeuta_id) ?? 0) + 1);
  }
  return [...map.entries()].map(([terapeutaId, sesiones]) => ({
    terapeutaId,
    sesiones,
  }));
}

/** Verifica que un payload de estadísticas no contenga PII obvia. */
export function assertAggregatesAreDissociated(payload: unknown): void {
  const text = JSON.stringify(payload).toLowerCase();
  const forbidden = [
    "diagnostico",
    "diagnóstico",
    "motivo_consulta",
    "nombre_completo",
    "email",
    "telefono",
    "teléfono",
  ];
  for (const key of forbidden) {
    if (text.includes(`"${key}"`)) {
      throw new Error(`Agregado contiene campo sensible: ${key}`);
    }
  }
}
