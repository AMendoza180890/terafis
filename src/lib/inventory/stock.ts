/**
 * Stock derivado de movimientos append-only.
 * No existe contador editable de “existencia”.
 */

export type InventoryMovementTipo =
  "entrada" | "salida" | "ajuste" | "venta" | "consumo_sesion";

export type StockMovement = {
  tipo: InventoryMovementTipo;
  /** Magnitud positiva para entrada/salida/venta/consumo; para ajuste usar signedDelta. */
  cantidad?: number;
  signedDelta?: number;
};

/** Delta firmado a partir del tipo (misma regla que la BD). */
export function movementDelta(m: StockMovement): number {
  if (m.tipo === "ajuste") {
    if (m.signedDelta == null || m.signedDelta === 0) {
      throw new Error("Ajuste requiere delta distinto de cero");
    }
    return m.signedDelta;
  }
  if (m.cantidad == null || m.cantidad <= 0) {
    throw new Error("Cantidad inválida");
  }
  if (m.tipo === "entrada") return m.cantidad;
  return -m.cantidad;
}

/** Existencia = suma de deltas. */
export function deriveStock(deltas: number[]): number {
  return deltas.reduce((acc, d) => acc + d, 0);
}

export function isBelowMinimum(existencia: number, stockMinimo: number): boolean {
  return existencia <= stockMinimo;
}
