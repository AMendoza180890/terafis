import { describe, expect, it } from "vitest";

import {
  currentYearMonthOptions,
  filterPaymentsByDate,
  monthEndDate,
  monthStartDate,
  sumPayments,
  yearMonthlyEarnings,
  type CajaPaymentRow,
} from "@/lib/payments/caja-periods";

function pay(
  partial: Partial<CajaPaymentRow> & {
    id: string;
    fechaPago: string;
    monto: number;
  },
): CajaPaymentRow {
  return {
    appointmentId: "a1",
    metodoPago: "cash",
    referencia: null,
    cambio: null,
    pacienteId: "p1",
    pacienteNombre: "Ana",
    servicios: [],
    ...partial,
  };
}

describe("caja periods (mes en curso)", () => {
  it("calcula bordes de mes", () => {
    expect(monthStartDate("2026-07")).toBe("2026-07-01");
    expect(monthEndDate("2026-07")).toBe("2026-07-31");
    expect(monthEndDate("2026-02")).toBe("2026-02-28");
  });

  it("opciones de mes solo del año en curso hasta el mes actual", () => {
    const opts = currentYearMonthOptions("America/Managua");
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0]?.value).toMatch(/^\d{4}-\d{2}$/);
    // El primero es el mes actual (lista invertida)
    const first = opts[0]!;
    const last = opts[opts.length - 1]!;
    expect(first.value >= last.value).toBe(true);
    expect(first.value.slice(0, 4)).toBe(last.value.slice(0, 4));
  });

  it("filtra por mes y rango de fechas", () => {
    const rows = [
      pay({
        id: "1",
        fechaPago: "2026-07-15T18:00:00.000Z", // 12:00 Managua
        monto: 100,
      }),
      pay({
        id: "2",
        fechaPago: "2026-07-20T18:00:00.000Z",
        monto: 50,
      }),
      pay({
        id: "3",
        fechaPago: "2026-06-10T18:00:00.000Z",
        monto: 999,
      }),
    ];
    const inMonth = filterPaymentsByDate(rows, { month: "2026-07" }, "America/Managua");
    expect(inMonth.map((p) => p.id).sort()).toEqual(["1", "2"]);

    const ranged = filterPaymentsByDate(
      rows,
      { month: "2026-07", desde: "2026-07-18", hasta: "2026-07-25" },
      "America/Managua",
    );
    expect(ranged.map((p) => p.id)).toEqual(["2"]);
  });

  it("suma totales", () => {
    const s = sumPayments([
      pay({ id: "1", fechaPago: "2026-07-01T12:00:00Z", monto: 100 }),
      pay({
        id: "2",
        fechaPago: "2026-07-01T13:00:00Z",
        monto: 50,
        metodoPago: "transferencia",
      }),
    ]);
    expect(s.total).toBe(150);
    expect(s.cash).toBe(100);
    expect(s.transferencia).toBe(50);
  });

  it("agrega ganancias solo de meses con movimiento", () => {
    const rows = [
      pay({
        id: "1",
        fechaPago: "2026-07-15T18:00:00.000Z",
        monto: 100,
      }),
      pay({
        id: "2",
        fechaPago: "2026-07-20T18:00:00.000Z",
        monto: 50,
        metodoPago: "transferencia",
      }),
      pay({
        id: "3",
        fechaPago: "2026-06-10T18:00:00.000Z",
        monto: 200,
      }),
    ];
    const months = yearMonthlyEarnings(rows, "America/Managua");
    expect(months.map((m) => m.key)).toEqual(["2026-06", "2026-07"]);
    expect(months.every((m) => m.count > 0)).toBe(true);
    expect(months[0]?.total).toBe(200);
    expect(months[1]?.total).toBe(150);
    expect(months[1]?.cash).toBe(100);
    expect(months[1]?.transferencia).toBe(50);
  });
});
