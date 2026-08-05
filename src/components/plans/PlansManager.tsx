"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AutoTextarea } from "@/components/ui/AutoTextarea";
import {
  TREATMENT_PLAN_FIELD_LABELS,
  TREATMENT_PLAN_PLACEHOLDERS,
} from "@/lib/labels/treatment-plan";
import {
  createTreatmentPlanAction,
  seedProtocolsAction,
} from "@/lib/treatment-plans/actions";

export function PlansManager({
  patients,
  protocols,
  isAdmin,
  defaultTerapeutaId,
}: {
  patients: Array<{ id: string; nombre: string }>;
  protocols: Array<{ id: string; titulo: string; codigo: string }>;
  isAdmin: boolean;
  defaultTerapeutaId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const result = await createTreatmentPlanAction({
              patientId: String(fd.get("patientId")),
              terapeutaId: defaultTerapeutaId,
              protocolId: String(fd.get("protocolId") || "") || undefined,
              diagnostico: String(fd.get("diagnostico")),
              objetivo: String(fd.get("objetivo")),
              frecuencia: String(fd.get("frecuencia")),
              duracionEstimadaSemanas: fd.get("semanas")
                ? Number(fd.get("semanas"))
                : undefined,
              ejerciciosDetalle: String(fd.get("ejerciciosDetalle") ?? ""),
            });
            setMessage(
              result.ok ? `Plan creado (v${result.version})` : result.error,
            );
            if (result.ok) router.refresh();
          });
        }}
      >
        <h2 className="font-semibold">Nuevo plan</h2>
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Paciente</span>
          <select
            name="patientId"
            required
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Protocolo (opcional)</span>
          <select
            name="protocolId"
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          >
            <option value="">—</option>
            {protocols.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block">
            {TREATMENT_PLAN_FIELD_LABELS.diagnostico}
          </span>
          <AutoTextarea
            name="diagnostico"
            required
            minRows={2}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block">
            {TREATMENT_PLAN_FIELD_LABELS.objetivo}
          </span>
          <AutoTextarea
            name="objetivo"
            required
            minRows={2}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
        <Field
          name="frecuencia"
          label={TREATMENT_PLAN_FIELD_LABELS.frecuencia}
          required
        />
        <Field
          name="semanas"
          label={TREATMENT_PLAN_FIELD_LABELS.duracionSemanas}
          type="number"
        />
        <label className="block text-sm">
          <span className="text-muted mb-1 block">
            {TREATMENT_PLAN_FIELD_LABELS.ejerciciosDetalle}
          </span>
          <AutoTextarea
            name="ejerciciosDetalle"
            required
            minRows={4}
            placeholder={TREATMENT_PLAN_PLACEHOLDERS.ejerciciosDetalle}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending || patients.length === 0}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white sm:w-auto"
        >
          Crear plan v1
        </button>
      </form>

      {isAdmin ? (
        <div className="border-brand/15 bg-surface rounded-xl border p-5">
          <h2 className="font-semibold">Protocolos plantilla</h2>
          <p className="text-muted mt-2 text-sm">
            Lumbalgia, hombro congelado, esguince de tobillo.
          </p>
          <button
            type="button"
            disabled={pending || protocols.length > 0}
            className="border-brand/30 text-brand mt-4 w-full rounded-md border px-4 py-2 text-sm disabled:opacity-50 sm:w-auto"
            onClick={() =>
              startTransition(async () => {
                const result = await seedProtocolsAction();
                setMessage(result.ok ? "Protocolos cargados" : result.error);
                router.refresh();
              })
            }
          >
            Cargar protocolos
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-muted text-sm lg:col-span-2">{message}</p>
      ) : null}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
