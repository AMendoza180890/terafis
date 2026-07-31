import { describe, expect, it } from "vitest";

import { fromCents, toCents } from "@/lib/money/cents";
import {
  absenteeismRate,
  assertAggregatesAreDissociated,
  cashCutByCashier,
  revenueCents,
} from "@/lib/reports/aggregates";

describe("ingresos del periodo (4.5)", () => {
  it("suma = pagos pagado en centavos; coincide con corte de caja", () => {
    const payments = [
      {
        monto: "100.50",
        metodo_pago: "cash",
        estado: "pagado",
        cajero_id: "c1",
        fecha_pago: "2026-07-30T12:00:00Z",
      },
      {
        monto: "200.00",
        metodo_pago: "transferencia",
        estado: "pagado",
        cajero_id: "c1",
        fecha_pago: "2026-07-30T13:00:00Z",
      },
      {
        monto: "50.00",
        metodo_pago: "cash",
        estado: "reembolsado",
        cajero_id: "c1",
        fecha_pago: "2026-07-30T14:00:00Z",
      },
    ];

    const total = revenueCents(payments);
    expect(fromCents(total)).toBe("300.50");
    expect(total).toBe(toCents("100.50") + toCents("200.00"));

    const cut = cashCutByCashier(payments);
    expect(cut).toHaveLength(1);
    expect(fromCents(cut[0]!.totalCents)).toBe("300.50");
  });
});

describe("ausentismo (4.6)", () => {
  it("tasa = no_asistio / citas del periodo", () => {
    const appts = [
      { estado: "completado", terapeuta_id: "t1", inicio: "a" },
      { estado: "no_asistio", terapeuta_id: "t1", inicio: "b" },
      { estado: "cancelado", terapeuta_id: "t2", inicio: "c" },
      { estado: "no_asistio", terapeuta_id: "t2", inicio: "d" },
    ];
    const r = absenteeismRate(appts);
    expect(r.noAsistio).toBe(2);
    expect(r.total).toBe(4);
    expect(r.rate).toBe(0.5);
  });
});

describe("agregados disociados (4.9)", () => {
  it("rechaza claves de PII/clínico en payload", () => {
    expect(() =>
      assertAggregatesAreDissociated({ ingresos: 100, diagnostico: "x" }),
    ).toThrow(/sensible/);
    expect(() =>
      assertAggregatesAreDissociated({ ingresosCents: 100, porMetodo: [] }),
    ).not.toThrow();
  });
});
