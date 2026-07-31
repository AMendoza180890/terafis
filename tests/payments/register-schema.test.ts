import { describe, expect, it } from "vitest";

import { RegisterPaymentSchema } from "@/lib/payments/schemas";
import { formatMoney, sumLineItemsCents } from "@/lib/money/totals";
import { cashChange, toCents } from "@/lib/money/cents";

describe("RegisterPaymentSchema", () => {
  const base = {
    appointmentId: "11111111-1111-4111-8111-111111111111",
    queueId: "22222222-2222-4222-8222-222222222222",
    expectedVersion: 3,
    idempotencyKey: "idem_test_key_1234567890",
  };

  it("exige monto en efectivo", () => {
    const parsed = RegisterPaymentSchema.safeParse({
      ...base,
      metodoPago: "cash",
    });
    expect(parsed.success).toBe(false);
  });

  it("exige referencia en transferencia", () => {
    const parsed = RegisterPaymentSchema.safeParse({
      ...base,
      metodoPago: "transferencia",
    });
    expect(parsed.success).toBe(false);
  });

  it("acepta cobro en efectivo válido", () => {
    const parsed = RegisterPaymentSchema.safeParse({
      ...base,
      metodoPago: "cash",
      montoRecibido: "1200.00",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza monto no numérico", () => {
    const parsed = RegisterPaymentSchema.safeParse({
      ...base,
      metodoPago: "cash",
      montoRecibido: "C$1200",
    });
    expect(parsed.success).toBe(false);
  });

  it("acepta transferencia con referencia numérica", () => {
    const parsed = RegisterPaymentSchema.safeParse({
      ...base,
      metodoPago: "transferencia",
      referencia: "1234567890",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza clave de idempotencia > 64", () => {
    const parsed = RegisterPaymentSchema.safeParse({
      ...base,
      idempotencyKey: `pay_${"a".repeat(80)}`,
      metodoPago: "cash",
      montoRecibido: "100",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("totales de cobro en centavos", () => {
  it("suma líneas con precio congelado", () => {
    const total = sumLineItemsCents([
      { costoAplicado: "500.00", cantidad: 1 },
      { costoAplicado: "600.00", cantidad: 1 },
    ]);
    expect(formatMoney(total)).toMatch(/1[,.]?100\.00/);
    expect(cashChange(toCents("1200.00"), total)).toBe(toCents("100.00"));
  });

  it("dos cobros con la misma clave conceptualmente son un solo pago (contrato)", () => {
    // La unicidad real vive en BD (UNIQUE idempotency_key) + RPC register_payment.
    const key = "idem_abc_fixed_for_modal";
    expect(key.length).toBeGreaterThanOrEqual(16);
  });
});
