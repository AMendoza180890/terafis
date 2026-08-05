"use client";

import { useMemo, useState, useTransition } from "react";

import {
  exportPatientsCsvAction,
  exportPatientsExcelAction,
  exportSummaryAction,
  getReportsSummaryAction,
  type ReportsSummary,
} from "@/lib/reports/actions";
import { formatCordobas } from "@/lib/money/format";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64(b64: string, filename: string, mime: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({ canExport }: { canExport: boolean }) {
  const range0 = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range0.from);
  const [to, setTo] = useState(range0.to);
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const period = () => ({
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
  });

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await getReportsSummaryAction(period());
            if (!res.ok) setError(res.error);
            else setData(res.data);
          });
        }}
      >
        <label className="w-full text-sm sm:w-auto">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border-brand/20 mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="w-full text-sm sm:w-auto">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-brand/20 mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          Calcular
        </button>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={pending}
          className="border-brand/30 text-brand w-full rounded-md border px-3 py-2 text-sm sm:w-auto"
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await exportSummaryAction({
                ...period(),
                format: "csv",
              });
              if (!res.ok) setError(res.error);
              else downloadText(res.content, res.filename, res.mime);
            });
          }}
        >
          Reporte CSV
        </button>
        <button
          type="button"
          disabled={pending}
          className="border-brand/30 text-brand w-full rounded-md border px-3 py-2 text-sm sm:w-auto"
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await exportSummaryAction({
                ...period(),
                format: "excel",
              });
              if (!res.ok) setError(res.error);
              else downloadText(res.content, res.filename, res.mime);
            });
          }}
        >
          Reporte Excel
        </button>
        <button
          type="button"
          disabled={pending}
          className="border-brand/30 text-brand w-full rounded-md border px-3 py-2 text-sm sm:w-auto"
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await exportSummaryAction({
                ...period(),
                format: "pdf",
              });
              if (!res.ok) setError(res.error);
              else downloadBase64(res.content, res.filename, res.mime);
            });
          }}
        >
          Reporte PDF
        </button>
        {canExport ? (
          <>
            <button
              type="button"
              disabled={pending}
              className="border-brand/30 text-brand w-full rounded-md border px-3 py-2 text-sm font-medium sm:w-auto"
              onClick={() => {
                setError(null);
                start(async () => {
                  const res = await exportPatientsCsvAction();
                  if (!res.ok) setError(res.error);
                  else downloadText(res.csv, res.filename, "text/csv;charset=utf-8");
                });
              }}
            >
              Pacientes CSV
            </button>
            <button
              type="button"
              disabled={pending}
              className="border-brand/30 text-brand w-full rounded-md border px-3 py-2 text-sm font-medium sm:w-auto"
              onClick={() => {
                setError(null);
                start(async () => {
                  const res = await exportPatientsExcelAction();
                  if (!res.ok) setError(res.error);
                  else downloadText(res.content, res.filename, res.mime);
                });
              }}
            >
              Pacientes Excel
            </button>
          </>
        ) : (
          <p className="text-muted self-center text-sm">
            Exportación con PII solo admin.
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Pacientes nuevos" value={String(data.pacientesNuevos)} />
          <Stat label="Ingresos del periodo" value={data.ingresosLabel} />
          <Stat
            label="Ausentismo"
            value={`${(data.ausentismo.rate * 100).toFixed(1)}%`}
            hint={`${data.ausentismo.noAsistio} / ${data.ausentismo.total} citas`}
          />
          <div className="border-brand/15 bg-surface rounded-xl border p-5 sm:col-span-2">
            <p className="text-muted text-sm">Ingresos por método</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.porMetodo.length === 0 ? (
                <li className="text-muted">Sin pagos</li>
              ) : (
                data.porMetodo.map((m) => (
                  <li key={m.metodo}>
                    {m.metodo}: {formatCordobas(m.total)}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="border-brand/15 bg-surface rounded-xl border p-5">
            <p className="text-muted text-sm">Corte de caja (por cajero)</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.corteCaja.length === 0 ? (
                <li className="text-muted">Sin cortes</li>
              ) : (
                data.corteCaja.map((c) => (
                  <li key={c.cajeroId}>
                    {c.cajeroId.slice(0, 8)}… — {formatCordobas(c.total)} ({c.count})
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="border-brand/15 bg-surface rounded-xl border p-5 sm:col-span-2">
            <p className="text-muted text-sm">Sesiones por terapeuta</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.sesionesPorTerapeuta.length === 0 ? (
                <li className="text-muted">Sin sesiones</li>
              ) : (
                data.sesionesPorTerapeuta.map((s) => (
                  <li key={s.terapeutaId}>
                    {s.terapeutaId.slice(0, 8)}… — {s.sesiones}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-muted text-sm">
          Seleccione un periodo y pulse Calcular. Los agregados no incluyen nombres ni
          diagnósticos.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-brand/15 bg-surface rounded-xl border p-5">
      <p className="text-muted text-sm">{label}</p>
      <p className="text-brand mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
