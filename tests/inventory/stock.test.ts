import { describe, expect, it } from "vitest";

import { deriveStock, isBelowMinimum, movementDelta } from "@/lib/inventory/stock";

describe("stock derivado (4.1)", () => {
  it("entrada + salida → existencia correcta", () => {
    const deltas = [
      movementDelta({ tipo: "entrada", cantidad: 10 }),
      movementDelta({ tipo: "salida", cantidad: 3 }),
      movementDelta({ tipo: "venta", cantidad: 2 }),
    ];
    expect(deltas).toEqual([10, -3, -2]);
    expect(deriveStock(deltas)).toBe(5);
  });

  it("no modela UPDATE de existencia — solo suma de movimientos", () => {
    // Contrato: no hay API de “setStock”; solo append de deltas.
    const stock = deriveStock([5, -1, -1]);
    expect(stock).toBe(3);
    expect(typeof (globalThis as { setStock?: unknown }).setStock).toBe("undefined");
  });

  it("alerta de reorden cuando stock ≤ mínimo (4.3)", () => {
    expect(isBelowMinimum(5, 5)).toBe(true);
    expect(isBelowMinimum(4, 5)).toBe(true);
    expect(isBelowMinimum(6, 5)).toBe(false);
  });

  it("ajuste admite delta positivo o negativo", () => {
    expect(movementDelta({ tipo: "ajuste", signedDelta: -2 })).toBe(-2);
    expect(movementDelta({ tipo: "ajuste", signedDelta: 4 })).toBe(4);
  });
});
