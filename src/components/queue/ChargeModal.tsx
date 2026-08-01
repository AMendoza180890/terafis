"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { cashChange, fromCents, toCents } from "@/lib/money/cents";
import { formatCordobas } from "@/lib/money/format";
import { getAppointmentTotalAction, registerPaymentAction } from "@/lib/payments/actions";

type Props = {
  appointmentId: string;
  queueId: string;
  expectedVersion: number;
  patientNombre: string;
  onClose: () => void;
  onPaid: (paymentId: string) => void;
};

/** Clave ≤64 chars (columna payments.idempotency_key). */
function makeIdempotencyKey(appointmentId: string): string {
  const appt = appointmentId.replace(/-/g, "").slice(0, 12);
  const rnd = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return `p_${appt}_${rnd}`; // 2+12+1+20 = 35
}

/** Solo dígitos y un punto decimal (máx. 2 decimales). */
function sanitizeMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

export function ChargeModal({
  appointmentId,
  queueId,
  expectedVersion,
  patientNombre,
  onClose,
  onPaid,
}: Props) {
  const [idempotencyKey] = useState(() => makeIdempotencyKey(appointmentId));

  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [metodo, setMetodo] = useState<"cash" | "transferencia">("cash");
  const [recibido, setRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [total, setTotal] = useState<string | null>(null);
  const [lines, setLines] = useState<
    Array<{ titulo: string; cantidad: number; subtotal: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTotal, setLoadingTotal] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getAppointmentTotalAction(appointmentId);
      if (cancelled) return;
      setLoadingTotal(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTotal(result.total);
      setLines(result.lines);
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const cambio = useMemo(() => {
    if (metodo !== "cash" || !total || !recibido) return null;
    try {
      return fromCents(cashChange(toCents(recibido), toCents(total)));
    } catch {
      return null;
    }
  }, [metodo, total, recibido]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerPaymentAction({
        appointmentId,
        queueId,
        expectedVersion,
        idempotencyKey,
        metodoPago: metodo,
        montoRecibido: metodo === "cash" ? recibido : undefined,
        referencia: metodo === "transferencia" ? referencia : undefined,
      });
      toast.fromActionResult(
        result,
        "Pago registrado",
        `Cobro de ${patientNombre} completado.`,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPaid(result.id);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charge-title"
    >
      <form
        onSubmit={submit}
        className="bg-surface text-foreground max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl p-6 shadow-xl"
      >
        <h2 id="charge-title" className="text-lg font-semibold">
          Cobrar — {patientNombre}
        </h2>

        {loadingTotal ? (
          <p className="text-muted mt-4 text-sm">Calculando total…</p>
        ) : (
          <ul className="mt-4 space-y-1 text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {l.titulo} × {l.cantidad}
                </span>
                <span>{formatCordobas(l.subtotal)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-brand mt-3 text-right text-xl font-semibold">
          Total {total ? formatCordobas(total) : "…"}
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-muted text-sm">Método</legend>
          <label className="mr-4 inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={metodo === "cash"}
              onChange={() => setMetodo("cash")}
            />
            Efectivo
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={metodo === "transferencia"}
              onChange={() => setMetodo("transferencia")}
            />
            Transferencia
          </label>
        </fieldset>

        {metodo === "cash" ? (
          <label className="mt-3 block text-sm">
            <span className="text-muted mb-1 block">Monto recibido (C$)</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]{0,2}"
              enterKeyHint="done"
              autoComplete="off"
              value={recibido}
              onChange={(e) => setRecibido(sanitizeMoneyInput(e.target.value))}
              placeholder="0.00"
              required
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 tabular-nums"
            />
            {cambio != null ? (
              <span className="text-muted mt-1 block text-xs">
                Cambio: {formatCordobas(cambio)}
              </span>
            ) : null}
          </label>
        ) : (
          <label className="mt-3 block text-sm">
            <span className="text-muted mb-1 block">N.º de referencia</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              autoComplete="off"
              value={referencia}
              onChange={(e) =>
                setReferencia(e.target.value.replace(/\D/g, "").slice(0, 64))
              }
              placeholder="Solo números"
              required
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 tabular-nums"
            />
          </label>
        )}

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border-brand/20 w-full rounded-md border px-4 py-2 text-sm sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || !total}
            className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Procesando…" : "Confirmar cobro"}
          </button>
        </div>
      </form>
    </div>
  );
}
