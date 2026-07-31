"use client";

import { useState, useTransition } from "react";

import { formatCordobas } from "@/lib/money/format";
import { finalizeConsultationAction } from "@/lib/queue/actions";

type ServiceOpt = { id: string; titulo: string; costo: string };

type Props = {
  appointmentId: string;
  queueId: string;
  expectedVersion: number;
  patientNombre: string;
  services: ServiceOpt[];
  onClose: () => void;
  onDone: () => void;
};

export function FinalizeServicesModal({
  appointmentId,
  queueId,
  expectedVersion,
  patientNombre,
  services,
  onClose,
  onDone,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const items = Object.entries(selected).map(([serviceId, cantidad]) => ({
      serviceId,
      cantidad,
    }));
    startTransition(async () => {
      const result = await finalizeConsultationAction({
        appointmentId,
        queueId,
        expectedVersion,
        items,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="bg-surface text-foreground max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Finalizar — {patientNombre}</h2>
        <p className="text-muted mt-1 text-sm">
          Seleccione los servicios aplicados. El paciente pasará a pendiente de
          pago para recepción.
        </p>
        <ul className="mt-4 space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <label className="border-brand/15 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[s.id])}
                    onChange={() => toggle(s.id)}
                  />
                  {s.titulo}
                </span>
                <span className="text-muted">
                  {formatCordobas(s.costo)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
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
            disabled={pending || Object.keys(selected).length === 0}
            className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Enviando…" : "Finalizar y enviar a cobro"}
          </button>
        </div>
      </form>
    </div>
  );
}
