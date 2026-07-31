"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { createAppointmentAction } from "@/lib/appointments/actions";

type Option = { id: string; label: string };

type Props = {
  patients: Option[];
  therapists: Option[];
  timezone: string;
};

export function AppointmentForm({ patients, therapists, timezone }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await createAppointmentAction({
        patientId: String(fd.get("patientId")),
        terapeutaId: String(fd.get("terapeutaId")),
        fecha: String(fd.get("fecha")),
        hora: String(fd.get("hora")),
        duracionMinutos: Number(fd.get("duracionMinutos") ?? 60),
        tipoServicio: String(fd.get("tipoServicio") ?? ""),
        notasAdmin: String(fd.get("notasAdmin") ?? ""),
        timezone,
      });

      toast.fromActionResult(result, "Cita guardada", "Agendada correctamente.");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOk("Cita agendada correctamente.");
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Nueva cita</h2>
      <p className="text-muted text-xs">
        Horarios en zona {timezone}. La BD rechaza solapes de terapeuta.
      </p>

      <Select label="Paciente" name="patientId" options={patients} required />
      <Select label="Terapeuta" name="terapeutaId" options={therapists} required />

      <div className="grid gap-4 sm:grid-cols-3">
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
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-muted mb-1 block">Tipo de servicio</span>
        <input
          name="tipoServicio"
          placeholder="Evaluación inicial"
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-muted mb-1 block">Notas administrativas</span>
        <AutoTextarea
          name="notasAdmin"
          minRows={2}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p
          className="bg-accent-soft text-foreground rounded-md p-3 text-sm"
          role="status"
        >
          {ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || patients.length === 0 || therapists.length === 0}
        className="bg-brand w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Agendando…" : "Agendar cita"}
      </button>
    </form>
  );
}

function Select({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: Option[];
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <select
        name={name}
        required={required}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      >
        {options.map((o) => (
          <option key={o.id || "empty"} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
