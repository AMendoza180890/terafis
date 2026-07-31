import { describe, expect, it } from "vitest";

import { addCents, cashChange, fromCents, toCents } from "@/lib/money/cents";
import { formatCordobas, formatMoney } from "@/lib/money/format";

describe("aritmética en centavos", () => {
  it("convierte montos decimales sin flotantes", () => {
    expect(toCents("10.50")).toBe(1050);
    expect(toCents(10.5)).toBe(1050);
    expect(fromCents(toCents("0.01"))).toBe("0.01");
    expect(fromCents(toCents("1100"))).toBe("1100.00");
  });

  it("suma y calcula cambio", () => {
    const total = addCents(toCents("500.00"), toCents("600.00"));
    expect(fromCents(total)).toBe("1100.00");
    expect(fromCents(cashChange(toCents("1200"), total))).toBe("100.00");
  });

  it("rechaza formato inválido", () => {
    expect(() => toCents("12.345")).toThrow(/inválido/);
  });
});

describe("formato en córdobas", () => {
  it("usa símbolo C$", () => {
    expect(formatCordobas("500.00")).toMatch(/^C\$ /);
    expect(formatCordobas("1100.5")).toContain("1");
    expect(formatMoney(toCents("250"))).toMatch(/^C\$ /);
  });
});
