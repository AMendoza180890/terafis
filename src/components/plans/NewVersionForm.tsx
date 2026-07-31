"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { createPlanVersionAction } from "@/lib/treatment-plans/actions";

export function NewVersionForm({
  planId,
  defaults,
}: {
  planId: string;
  defaults: {
    diagnostico: string;
    objetivo: string;
    frecuencia: string;
    semanas?: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await createPlanVersionAction({
            planId,
            diagnostico: String(fd.get("diagnostico")),
            objetivo: String(fd.get("objetivo")),
            frecuencia: String(fd.get("frecuencia")),
            duracionEstimadaSemanas: fd.get("semanas")
              ? Number(fd.get("semanas"))
              : undefined,
            exercises: [],
          });
          setMessage(
            result.ok ? `Nueva versión ${result.version} guardada` : result.error,
          );
          if (result.ok) router.refresh();
        });
      }}
    >
      <h2 className="font-semibold">Nueva versión del plan</h2>
      <p className="text-muted text-xs">
        Cada edición crea una versión nueva (no se sobrescribe el historial).
      </p>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Diagnóstico</span>
        <AutoTextarea
          name="diagnostico"
          required
          defaultValue={defaults.diagnostico}
          minRows={2}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Objetivo</span>
        <AutoTextarea
          name="objetivo"
          required
          defaultValue={defaults.objetivo}
          minRows={2}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Frecuencia</span>
        <input
          name="frecuencia"
          required
          defaultValue={defaults.frecuencia}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Semanas</span>
        <input
          name="semanas"
          type="number"
          defaultValue={defaults.semanas}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white sm:w-auto"
      >
        Guardar nueva versión
      </button>
      {message ? <p className="text-muted text-sm">{message}</p> : null}
    </form>
  );
}
