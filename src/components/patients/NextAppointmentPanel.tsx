"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { createAppointmentAction } from "@/lib/appointments/actions";

type Option = { id: string; label: string };

type Props = {
  patientId: string;
  patientNombre: string;
  therapists: Option[];
  /** Fisio actual: se preselecciona y, si es terapeuta, no puede cambiarlo. */
  defaultTerapeutaId: string;
  lockTherapist?: boolean;
  timezone: string;
};

export function NextAppointmentPanel({
  patientId,
  patientNombre,
  therapists,
  defaultTerapeutaId,
  lockTherapist = false,
  timezone,
}: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [terapeutaId, setTerapeutaId] = useState(
    defaultTerapeutaId || therapists[0]?.id || "",
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await createAppointmentAction({
        patientId,
        terapeutaId: lockTherapist
          ? defaultTerapeutaId
          : String(fd.get("terapeutaId") || terapeutaId),
        fecha: String(fd.get("fecha")),
        hora: String(fd.get("hora")),
        duracionMinutos: Number(fd.get("duracionMinutos") ?? 60),
        tipoServicio: String(fd.get("tipoServicio") ?? "Consulta de seguimiento"),
        notasAdmin: String(fd.get("notasAdmin") ?? ""),
        timezone,
      });

      toast.fromActionResult(
        result,
        "Siguiente cita agendada",
        `${patientNombre} quedó en agenda.`,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOk("Siguiente cita agendada correctamente.");
      form.reset();
      if (!lockTherapist) {
        setTerapeutaId(defaultTerapeutaId || therapists[0]?.id || "");
      }
    });
  }

  return (
    <section className="border-brand/15 bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Siguiente cita</h2>
          <p className="text-muted mt-1 text-sm">
            Opcional. Agende el próximo control si el paciente lo necesita.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="border-brand/30 text-brand w-full rounded-md border px-4 py-2 text-sm font-semibold sm:w-auto"
        >
          {open ? "Ocultar" : "Agendar siguiente cita"}
        </button>
      </div>

      {open ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <p className="text-sm">
            Paciente: <span className="font-medium">{patientNombre}</span>
          </p>

          {lockTherapist ? (
            <input type="hidden" name="terapeutaId" value={defaultTerapeutaId} />
          ) : (
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Terapeuta</span>
              <select
                name="terapeutaId"
                required
                value={terapeutaId}
                onChange={(e) => setTerapeutaId(e.target.value)}
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              >
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {lockTherapist ? (
            <p className="text-muted text-xs">
              Se agendará con usted como terapeuta.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Fecha</span>
              <input
                type="date"
                name="fecha"
                required
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Hora</span>
              <input
                type="time"
                name="hora"
                required
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Duración (min)</span>
              <input
                type="number"
                name="duracionMinutos"
                defaultValue={60}
                min={15}
                step={15}
                inputMode="numeric"
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-muted mb-1 block">Tipo de servicio</span>
            <input
              name="tipoServicio"
              defaultValue="Consulta de seguimiento"
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted mb-1 block">Notas</span>
            <AutoTextarea
              name="notasAdmin"
              minRows={2}
              placeholder="Indicaciones para la próxima sesión…"
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-accent text-sm font-medium" role="status">
              {ok}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || !terapeutaId}
            className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Agendando…" : "Guardar siguiente cita"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
