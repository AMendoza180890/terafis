"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CajaEarningsChart } from "@/components/caja/CajaEarningsChart";
import { formatInClinicTz } from "@/lib/datetime/clinic-tz";
import { formatCordobas } from "@/lib/money/format";
import {
  attendedDatesInMonth,
  clinicCurrentMonthKey,
  clinicTodayIso,
  currentYearMonthOptions,
  filterPaymentsByDate,
  monthEndDate,
  monthStartDate,
  sumPayments,
  yearMonthlyEarnings,
  type CajaPaymentRow,
} from "@/lib/payments/caja-periods";

type Props = {
  payments: CajaPaymentRow[];
  timezone: string;
};

export function CajaDashboard({ payments, timezone }: Props) {
  const monthOptions = useMemo(() => currentYearMonthOptions(timezone), [timezone]);
  const currentMonth = clinicCurrentMonthKey(timezone);
  const today = clinicTodayIso(timezone);

  const [month, setMonth] = useState(currentMonth);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const filtered = useMemo(
    () =>
      filterPaymentsByDate(
        payments,
        {
          month,
          desde: desde || undefined,
          hasta: hasta || undefined,
        },
        timezone,
      ),
    [payments, month, desde, hasta, timezone],
  );

  const summary = useMemo(() => sumPayments(filtered), [filtered]);
  const datesWithMoves = useMemo(
    () => attendedDatesInMonth(payments, month, timezone),
    [payments, month, timezone],
  );
  const monthlyEarnings = useMemo(
    () => yearMonthlyEarnings(payments, timezone),
    [payments, timezone],
  );

  const monthLabel = monthOptions.find((m) => m.value === month)?.label ?? month;

  function selectMonth(monthKey: string) {
    setMonth(monthKey);
    setDesde("");
    setHasta("");
  }

  function resetToCurrentMonth() {
    selectMonth(currentMonth);
  }

  function filterToday() {
    setMonth(currentMonth);
    setDesde(today);
    setHasta(today);
  }

  function clearDates() {
    setDesde("");
    setHasta("");
  }

  function selectDay(day: string) {
    setDesde(day);
    setHasta(day);
  }

  const minDate = monthStartDate(month);
  const maxDate = month === currentMonth ? today : monthEndDate(month);

  return (
    <div className="space-y-8">
      <CajaEarningsChart
        months={monthlyEarnings}
        selectedMonth={month}
        onSelectMonth={selectMonth}
      />

      <section className="border-brand/15 bg-surface space-y-4 rounded-xl border p-4">
        <div>
          <h2 className="font-semibold">Filtros</h2>
          <p className="text-muted mt-1 text-sm">
            Mes en curso por defecto. Elija otro mes o un rango de fechas atendidas.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-muted mb-1 block text-xs">Mes</span>
            <select
              value={month}
              onChange={(e) => selectMonth(e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 capitalize"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted mb-1 block text-xs">Desde</span>
            <input
              type="date"
              value={desde}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDesde(e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted mb-1 block text-xs">Hasta</span>
            <input
              type="date"
              value={hasta}
              min={desde || minDate}
              max={maxDate}
              onChange={(e) => setHasta(e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
            />
          </label>
          <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end">
            <button
              type="button"
              onClick={filterToday}
              className="border-brand/20 w-full rounded-md border px-3 py-2 text-sm font-medium sm:w-auto"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={clearDates}
              className="border-brand/20 w-full rounded-md border px-3 py-2 text-sm font-medium sm:w-auto"
            >
              Todo el mes
            </button>
            <button
              type="button"
              onClick={resetToCurrentMonth}
              className="bg-brand w-full rounded-md px-3 py-2 text-sm font-semibold text-white sm:w-auto"
            >
              Mes actual
            </button>
          </div>
        </div>

        {datesWithMoves.length > 0 ? (
          <div>
            <p className="text-muted mb-2 text-xs">
              Días con atención / cobro en {monthLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {datesWithMoves.map((d) => {
                const active = desde === d && hasta === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => selectDay(d)}
                    className={[
                      "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums",
                      active ? "bg-brand text-white" : "border-brand/20 border",
                    ].join(" ")}
                  >
                    {d.slice(8)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <div>
        <h2 className="font-semibold capitalize">
          {desde || hasta
            ? `Movimientos${desde ? ` desde ${desde}` : ""}${hasta ? ` hasta ${hasta}` : ""}`
            : `Mes en curso — ${monthLabel}`}
        </h2>
        <p className="text-muted mt-1 text-sm">
          Detalle de pacientes atendidos, servicios y costos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Ingresos del período"
          value={formatCordobas(summary.total)}
          emphasis
        />
        <Stat label="Movimientos" value={String(summary.count)} />
        <Stat label="Efectivo" value={formatCordobas(summary.cash)} />
        <Stat label="Transferencia" value={formatCordobas(summary.transferencia)} />
      </div>

      <section>
        <div className="border-brand/15 bg-surface overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-brand/10 text-muted border-b">
              <tr>
                <th className="px-4 py-3">Fecha / hora</th>
                <th className="px-4 py-3">Paciente atendido</th>
                <th className="px-4 py-3">Servicios</th>
                <th className="px-4 py-3">Costo servicios</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Total cobrado</th>
                <th className="px-4 py-3">Cambio / Ref.</th>
                <th className="px-4 py-3 text-right">Factura</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted px-4 py-8 text-center">
                    Sin cobros para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const serviciosCosto = p.servicios.reduce(
                    (acc, s) => acc + s.subtotal,
                    0,
                  );
                  return (
                    <tr key={p.id} className="border-brand/5 border-b align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatInClinicTz(p.fechaPago, timezone, "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-3 font-medium">{p.pacienteNombre}</td>
                      <td className="px-4 py-3">
                        {p.servicios.length === 0 ? (
                          <span className="text-muted">Sin detalle</span>
                        ) : (
                          <ul className="space-y-1">
                            {p.servicios.map((s, i) => (
                              <li key={`${p.id}-${i}`}>
                                <span>{s.titulo}</span>
                                {s.cantidad > 1 ? (
                                  <span className="text-muted"> × {s.cantidad}</span>
                                ) : null}
                                <span className="text-muted">
                                  {" "}
                                  ({formatCordobas(s.costoUnitario)}
                                  {s.cantidad > 1
                                    ? ` c/u → ${formatCordobas(s.subtotal)}`
                                    : ""}
                                  )
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {p.servicios.length > 0 ? formatCordobas(serviciosCosto) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.metodoPago === "cash" ? "Efectivo" : "Transferencia"}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatCordobas(p.monto)}
                      </td>
                      <td className="text-muted px-4 py-3">
                        {p.metodoPago === "cash"
                          ? p.cambio != null
                            ? `Cambio ${formatCordobas(p.cambio)}`
                            : "—"
                          : (p.referencia ?? "—")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/app/caja/pagos/${p.id}`}
                          className="text-brand text-xs font-medium underline-offset-2 hover:underline"
                        >
                          Ver / imprimir
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="border-brand/15 bg-surface rounded-xl border px-4 py-4">
      <p className="text-muted text-xs">{label}</p>
      <p
        className={[
          "mt-1 font-semibold tabular-nums",
          emphasis ? "text-brand text-2xl" : "text-lg",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
