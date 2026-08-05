import { addCents, toCents, type Cents } from "@/lib/money/cents";
import { formatMoney as formatMoneyCordobas } from "@/lib/money/format";

export type LineItem = {
  costoAplicado: string | number;
  cantidad: number;
};

/** Suma líneas de appointment_services en centavos (servidor). */
export function sumLineItemsCents(items: LineItem[]): Cents {
  return items.reduce((acc, item) => {
    const unit = toCents(item.costoAplicado);
    const line = (unit * item.cantidad) as Cents;
    return addCents(acc, line);
  }, 0 as Cents);
}

/** Formato monetario en córdobas (C$). */
export function formatMoney(cents: Cents): string {
  return formatMoneyCordobas(cents);
}

export { formatCordobas } from "@/lib/money/format";
