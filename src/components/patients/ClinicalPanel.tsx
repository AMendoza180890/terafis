"use client";

import { useEffect, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { CLINICAL_FIELD_LABELS } from "@/lib/labels/clinical";
import {
  getPatientClinicalAction,
  updatePatientClinicalAction,
} from "@/lib/patients/actions";

type Props = {
  patientId: string;
  clinicalId: string;
  readOnly?: boolean;
};

/** Acepta solo enteros 0–10; valores legacy de texto libre se descartan. */
function normalizeVassScale(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const trimmed = value.trim();
  if (/^(10|[0-9])$/.test(trimmed)) return trimmed;
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 0 && n <= 10) return String(n);
  return "";
}

export function ClinicalPanel({ patientId, clinicalId, readOnly = false }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [values, setValues] = useState({
    historialMedico: "",
    alergias: "",
    medicamentos: "",
    diagnosticosPrevios: "",
    anamnesis: "",
    exploracionFisica: "",
    diagnosticoFisioterapeutico: "",
    objetivoTratamiento: "",
  });

  useEffect(() => {
    startTransition(async () => {
      const result = await getPatientClinicalAction(clinicalId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.clinical) {
        setTitulo(result.clinical.titulo?.trim() || "Expediente clínico");
        setValues({
          historialMedico: result.clinical.historial_medico ?? "",
          alergias: result.clinical.alergias ?? "",
          medicamentos: result.clinical.medicamentos ?? "",
          diagnosticosPrevios: result.clinical.diagnosticos_previos ?? "",
          anamnesis: normalizeVassScale(result.clinical.anamnesis),
          exploracionFisica: result.clinical.exploracion_fisica ?? "",
          diagnosticoFisioterapeutico: result.clinical.diagnostico_fisioterapeutico ?? "",
          objetivoTratamiento: result.clinical.objetivo_tratamiento ?? "",
        });
      }
    });
  }, [clinicalId]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    startTransition(async () => {
      const result = await updatePatientClinicalAction({
        patientId,
        clinicalId,
        titulo,
        ...values,
      });
      toast.fromActionResult(result, "Expediente guardado");
      if (!result.ok) setError(result.error);
    });
  }

  const hasContent =
    titulo.trim().length > 0 || Object.values(values).some((v) => v.trim().length > 0);

  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <p className="text-muted text-xs">
        {pending && !hasContent && !error
          ? "Cargando expediente…"
          : readOnly
            ? "Expediente cerrado (solo lectura)."
            : hasContent
              ? "Datos del episodio clínico seleccionado."
              : "Complete el expediente de este episodio."}
      </p>
      <label className="block text-sm">
        <span className="text-muted mb-1 block">{CLINICAL_FIELD_LABELS.titulo}</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={readOnly || pending}
          required
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      {(
        ["historialMedico", "alergias", "medicamentos", "diagnosticosPrevios"] as const
      ).map((key) => (
        <label key={key} className="block text-sm">
          <span className="text-muted mb-1 block">{CLINICAL_FIELD_LABELS[key]}</span>
          <AutoTextarea
            value={values[key]}
            onChange={(ev) => setValues((v) => ({ ...v, [key]: ev.target.value }))}
            minRows={2}
            disabled={readOnly}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
          />
        </label>
      ))}
      <label className="block text-sm">
        <span className="text-muted mb-1 block">{CLINICAL_FIELD_LABELS.anamnesis}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={10}
          step={1}
          value={values.anamnesis}
          onChange={(ev) => {
            const raw = ev.target.value;
            if (raw === "") {
              setValues((v) => ({ ...v, anamnesis: "" }));
              return;
            }
            if (!/^\d{1,2}$/.test(raw)) return;
            const n = Number(raw);
            if (n < 0 || n > 10) return;
            setValues((v) => ({ ...v, anamnesis: String(n) }));
          }}
          disabled={readOnly}
          className="border-brand/20 bg-background w-full max-w-[8rem] rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      {(
        [
          "exploracionFisica",
          "diagnosticoFisioterapeutico",
          "objetivoTratamiento",
        ] as const
      ).map((key) => (
        <label key={key} className="block text-sm">
          <span className="text-muted mb-1 block">{CLINICAL_FIELD_LABELS[key]}</span>
          <AutoTextarea
            value={values[key]}
            onChange={(ev) => setValues((v) => ({ ...v, [key]: ev.target.value }))}
            minRows={2}
            disabled={readOnly}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
          />
        </label>
      ))}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!readOnly ? (
        <button
          type="submit"
          disabled={pending}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Guardando…" : "Guardar expediente"}
        </button>
      ) : null}
    </form>
  );
}
