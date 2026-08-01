"use client";

import Link from "next/link";

import { formatInClinicTz } from "@/lib/datetime/clinic-tz";
import { formatCordobas } from "@/lib/money/format";
import type { PaymentReceipt } from "@/lib/payments/receipt";

function metodoLabel(metodo: string): string {
  if (metodo === "cash") return "Efectivo";
  if (metodo === "transferencia") return "Transferencia";
  return metodo;
}

export function PaymentReceiptView({ receipt }: { receipt: PaymentReceipt }) {
  const shortId = receipt.paymentId.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/app/caja"
            className="text-brand text-sm font-medium underline-offset-2 hover:underline"
          >
            ← Volver a caja
          </Link>
          <h1 className="font-serif mt-1 text-2xl sm:text-3xl">
            Factura / comprobante
          </h1>
          <p className="text-muted text-sm">
            Revise la información y envíe a la impresora del cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-brand rounded-md px-4 py-2.5 text-sm font-semibold text-white"
        >
          Imprimir para el cliente
        </button>
      </div>

      <article
        id="payment-receipt"
        className="border-brand/15 bg-surface mx-auto max-w-2xl space-y-5 rounded-xl border p-6 text-sm print:max-w-none print:border-0 print:p-0 print:shadow-none"
      >
        <header className="border-brand/10 space-y-1 border-b pb-4 text-center">
          <p className="font-serif text-2xl font-semibold tracking-tight">
            {receipt.clinicNombre}
          </p>
          {receipt.clinicDireccion ? (
            <p className="text-muted text-xs">{receipt.clinicDireccion}</p>
          ) : null}
          {receipt.clinicTelefono ? (
            <p className="text-muted text-xs">Tel. {receipt.clinicTelefono}</p>
          ) : null}
          <p className="pt-2 text-xs font-medium uppercase tracking-wide">
            Comprobante de atención
          </p>
          <p className="text-muted text-xs">N.º {shortId}</p>
        </header>

        <section className="grid gap-2 sm:grid-cols-2">
          <Field label="Paciente" value={receipt.pacienteNombre} />
          <Field
            label="Fecha de cobro"
            value={formatInClinicTz(
              receipt.fechaPago,
              receipt.timezone,
              "dd/MM/yyyy HH:mm",
            )}
          />
          <Field label="Método de pago" value={metodoLabel(receipt.metodoPago)} />
          {receipt.cajeroNombre ? (
            <Field label="Atendido en caja por" value={receipt.cajeroNombre} />
          ) : null}
          {receipt.referencia ? (
            <Field label="Referencia" value={receipt.referencia} />
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Servicios cobrados</h2>
          {receipt.lines.length === 0 ? (
            <p className="text-muted">Sin líneas de servicio.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-brand/10 text-muted border-b text-xs">
                  <th className="py-1.5 pr-2 font-medium">Concepto</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Cant.</th>
                  <th className="py-1.5 pr-2 text-right font-medium">P. unit.</th>
                  <th className="py-1.5 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((l, i) => (
                  <tr key={i} className="border-brand/5 border-b">
                    <td className="py-2 pr-2">{l.titulo}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {l.cantidad}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatCordobas(l.costoUnitario)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCordobas(l.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 space-y-1 text-right">
            <p className="text-lg font-semibold">
              Total {formatCordobas(receipt.monto)}
            </p>
            {receipt.montoRecibido ? (
              <p className="text-muted text-xs">
                Recibido: {formatCordobas(receipt.montoRecibido)}
                {receipt.cambio != null
                  ? ` · Cambio: ${formatCordobas(receipt.cambio)}`
                  : ""}
              </p>
            ) : null}
          </div>
        </section>

        {receipt.sessionNote ? (
          <section className="border-brand/10 space-y-2 border-t pt-4">
            <h2 className="text-base font-semibold">
              Seguimiento de la consulta
            </h2>
            <NoteBlock
              label="Evolución"
              value={receipt.sessionNote.notasEvolucion}
            />
            <NoteBlock
              label="Tratamiento"
              value={receipt.sessionNote.tratamiento}
            />
            <NoteBlock
              label="Observaciones"
              value={receipt.sessionNote.observaciones}
            />
            <NoteBlock
              label="Rango de movimiento"
              value={receipt.sessionNote.rangoMovimiento}
            />
            {receipt.sessionNote.dolorEva != null ? (
              <p>
                <span className="text-muted">Dolor EVA: </span>
                {receipt.sessionNote.dolorEva}/10
              </p>
            ) : null}
          </section>
        ) : (
          <section className="border-brand/10 border-t pt-4">
            <h2 className="text-base font-semibold">
              Seguimiento de la consulta
            </h2>
            <p className="text-muted mt-1">
              No hay seguimiento vinculado a esta atención.
            </p>
          </section>
        )}

        {receipt.treatmentPlan ? (
          <section className="border-brand/10 space-y-2 border-t pt-4">
            <h2 className="text-base font-semibold">
              Plan de tratamiento (v{receipt.treatmentPlan.version})
            </h2>
            <NoteBlock
              label="Diagnóstico"
              value={receipt.treatmentPlan.diagnostico}
            />
            <NoteBlock
              label="Objetivo"
              value={receipt.treatmentPlan.objetivo}
            />
            <p>
              <span className="text-muted">Frecuencia: </span>
              {receipt.treatmentPlan.frecuencia}
              {receipt.treatmentPlan.duracionEstimadaSemanas != null
                ? ` · ${receipt.treatmentPlan.duracionEstimadaSemanas} semanas`
                : ""}
            </p>
            <NoteBlock
              label="Ejercicio, series y repeticiones"
              value={receipt.treatmentPlan.ejerciciosDetalle}
            />
          </section>
        ) : (
          <section className="border-brand/10 border-t pt-4">
            <h2 className="text-base font-semibold">Plan de tratamiento</h2>
            <p className="text-muted mt-1">
              No hay plan de tratamiento activo para este paciente.
            </p>
          </section>
        )}

        <footer className="border-brand/10 text-muted border-t pt-4 text-center text-xs">
          <p>Gracias por su preferencia. Conserve este comprobante.</p>
          <p className="mt-1 print:hidden">
            Use el botón «Imprimir para el cliente» o Ctrl+P / Cmd+P.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted block text-xs">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function NoteBlock({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
