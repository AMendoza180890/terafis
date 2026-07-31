/**
 * Aritmética monetaria en centavos enteros (§9).
 * Nunca usar number flotante para sumas de dinero.
 */

export type Cents = number & { readonly __brand: "Cents" };

export function toCents(amount: string | number): Cents {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      throw new Error("Monto no finito.");
    }
    return Math.round(amount * 100) as Cents;
  }

  const normalized = amount.trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Monto inválido: ${amount}`);
  }
  const [whole, frac = ""] = normalized.split(".");
  const sign = whole?.startsWith("-") ? -1 : 1;
  const absWhole = Math.abs(Number(whole));
  const fracPadded = (frac + "00").slice(0, 2);
  return (sign * (absWhole * 100 + Number(fracPadded))) as Cents;
}

export function fromCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

export function addCents(a: Cents, b: Cents): Cents {
  return (a + b) as Cents;
}

export function subCents(a: Cents, b: Cents): Cents {
  return (a - b) as Cents;
}

/** Cambio en efectivo: recibido - total. Negativo = insuficiente. */
export function cashChange(recibido: Cents, total: Cents): Cents {
  return subCents(recibido, total);
}
