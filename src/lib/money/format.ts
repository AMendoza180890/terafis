import { fromCents, toCents, type Cents } from "@/lib/money/cents";

/** Córdobas nicaragüenses (NIO). */
export const CURRENCY_CODE = "NIO";
export const CURRENCY_SYMBOL = "C$";

/**
 * Formatea un monto decimal (string o number) como córdobas.
 * Ej: formatCordobas("1100.50") → "C$ 1,100.50"
 */
export function formatCordobas(amount: string | number): string {
  let value: number;
  if (typeof amount === "number") {
    value = amount;
  } else {
    try {
      value = Number(fromCents(toCents(amount)));
    } catch {
      value = Number(amount);
    }
  }
  if (!Number.isFinite(value)) {
    return `${CURRENCY_SYMBOL} 0.00`;
  }
  const formatted = new Intl.NumberFormat("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${CURRENCY_SYMBOL} ${formatted}`;
}

/** Formatea centavos enteros como córdobas. */
export function formatMoney(cents: Cents): string {
  return formatCordobas(fromCents(cents));
}
