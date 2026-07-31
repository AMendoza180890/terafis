"use client";

import { formatCordobas } from "@/lib/money/format";
import type { MonthEarnings } from "@/lib/payments/caja-periods";

type Props = {
  months: MonthEarnings[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
};

export function CajaEarningsChart({
  months,
  selectedMonth,
  onSelectMonth,
}: Props) {
  const maxTotal = Math.max(1, ...months.map((m) => m.total));
  const yearTotal = months.reduce((acc, m) => acc + m.total, 0);

  return (
    <section className="border-brand/15 bg-surface rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ganancias por mes</h2>
          <p className="text-muted mt-1 text-sm">
            Solo meses con cobros. Pulse un mes para ver el detalle.
          </p>
        </div>
        <p className="text-sm">
          <span className="text-muted">Total año · </span>
          <span className="text-brand font-semibold tabular-nums">
            {formatCordobas(yearTotal)}
          </span>
        </p>
      </div>

      {months.length === 0 ? (
        <p className="text-muted mt-6 text-center text-sm">
          Aún no hay cobros registrados este año.
        </p>
      ) : (
      <div className="mt-5 flex items-end gap-2 sm:gap-3" style={{ height: 180 }}>
        {months.map((m) => {
          const heightPct = Math.max(
            m.total > 0 ? 8 : 2,
            Math.round((m.total / maxTotal) * 100),
          );
          const cashPct =
            m.total > 0 ? Math.round((m.cash / m.total) * 100) : 0;
          const transferPct = m.total > 0 ? 100 - cashPct : 0;
          const selected = m.key === selectedMonth;

          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelectMonth(m.key)}
              title={`${m.label}: ${formatCordobas(m.total)} (${m.count} mov.)`}
              aria-pressed={selected}
              className={[
                "group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-md outline-none",
                "focus-visible:ring-brand focus-visible:ring-2",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[10px] font-medium tabular-nums sm:text-xs",
                  selected ? "text-brand" : "text-muted",
                ].join(" ")}
              >
                {m.total > 0 ? formatCordobas(m.total) : "—"}
              </span>
              <div
                className={[
                  "relative flex w-full max-w-14 flex-col justify-end overflow-hidden rounded-t-md transition-[height,opacity] duration-500 sm:max-w-16",
                  selected
                    ? "ring-brand/40 ring-2 ring-offset-1"
                    : "opacity-85 group-hover:opacity-100",
                ].join(" ")}
                style={{ height: `${heightPct}%` }}
              >
                {m.total === 0 ? (
                  <div className="bg-brand/15 h-full w-full" />
                ) : (
                  <>
                    {transferPct > 0 ? (
                      <div
                        className="w-full bg-[#5a8f9e]"
                        style={{ height: `${transferPct}%` }}
                        title={`Transferencia ${formatCordobas(m.transferencia)}`}
                      />
                    ) : null}
                    {cashPct > 0 ? (
                      <div
                        className="bg-brand w-full"
                        style={{ height: `${cashPct}%` }}
                        title={`Efectivo ${formatCordobas(m.cash)}`}
                      />
                    ) : null}
                  </>
                )}
              </div>
              <span
                className={[
                  "text-xs capitalize",
                  selected ? "text-brand font-semibold" : "text-muted",
                ].join(" ")}
              >
                {m.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {months.length > 0 ? (
        <div className="text-muted mt-4 flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-brand inline-block size-2.5 rounded-sm" />
            Efectivo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[#5a8f9e]" />
            Transferencia
          </span>
        </div>
      ) : null}
    </section>
  );
}
