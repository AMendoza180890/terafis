"use client";

import { AutoTextarea } from "@/components/ui/AutoTextarea";

export type PlanFormState = {
  diagnostico: string;
  objetivo: string;
  frecuencia: string;
  semanas: string;
  ejerciciosDetalle: string;
};

export const emptyPlanForm = (): PlanFormState => ({
  diagnostico: "",
  objetivo: "",
  frecuencia: "",
  semanas: "",
  ejerciciosDetalle: "",
});

type Props = {
  value: PlanFormState;
  onChange: (next: PlanFormState) => void;
  disabled?: boolean;
  required?: boolean;
  showTitle?: boolean;
};

export function TreatmentPlanFields({
  value,
  onChange,
  disabled = false,
  required = false,
  showTitle = true,
}: Props) {
  function set<K extends keyof PlanFormState>(key: K, v: PlanFormState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="border-brand/15 space-y-3 rounded-lg border p-3">
      {showTitle ? (
        <div>
          <h4 className="text-sm font-semibold">Plan de tratamiento</h4>
          <p className="text-muted text-xs">
            Opcional: complete solo si el paciente lo requiere en esta atención.
          </p>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="text-muted mb-1 block">Diagnóstico fisioterapéutico</span>
        <AutoTextarea
          required={required}
          disabled={disabled}
          minRows={2}
          value={value.diagnostico}
          onChange={(e) => set("diagnostico", e.target.value)}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Objetivo</span>
        <AutoTextarea
          required={required}
          disabled={disabled}
          minRows={2}
          value={value.objetivo}
          onChange={(e) => set("objetivo", e.target.value)}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Frecuencia (ej. 2x/semana)</span>
        <input
          required={required}
          disabled={disabled}
          value={value.frecuencia}
          onChange={(e) => set("frecuencia", e.target.value)}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Duración (semanas)</span>
        <input
          type="number"
          min={1}
          disabled={disabled}
          value={value.semanas}
          onChange={(e) => set("semanas", e.target.value)}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">
          Ejercicio, series y repeticiones
        </span>
        <AutoTextarea
          required={required}
          disabled={disabled}
          minRows={4}
          value={value.ejerciciosDetalle}
          onChange={(e) => set("ejerciciosDetalle", e.target.value)}
          placeholder={
            "Ej.\nPuente de glúteos — 3 series × 12 repeticiones\nBird-dog — 3 series × 10, pausa 5 s"
          }
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
    </div>
  );
}
