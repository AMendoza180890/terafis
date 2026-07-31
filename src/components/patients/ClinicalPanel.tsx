"use client";

import { useEffect, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import {
  getPatientClinicalAction,
  updatePatientClinicalAction,
} from "@/lib/patients/actions";

type Props = {
  patientId: string;
  clinicalId: string;
  readOnly?: boolean;
};

export function ClinicalPanel({
  patientId,
  clinicalId,
  readOnly = false,
}: Props) {
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
          anamnesis: result.clinical.anamnesis ?? "",
          exploracionFisica: result.clinical.exploracion_fisica ?? "",
          diagnosticoFisioterapeutico:
            result.clinical.diagnostico_fisioterapeutico ?? "",
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
    titulo.trim().length > 0 ||
    Object.values(values).some((v) => v.trim().length > 0);

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
        <span className="text-muted mb-1 block">Título / motivo</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={readOnly || pending}
          required
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
        />
      </label>
      {(
        [
          ["historialMedico", "Historial médico"],
          ["alergias", "Alergias"],
          ["medicamentos", "Medicamentos"],
          ["diagnosticosPrevios", "Diagnósticos previos"],
          ["anamnesis", "Anamnesis"],
          ["exploracionFisica", "Exploración física"],
          ["diagnosticoFisioterapeutico", "Diagnóstico fisioterapéutico"],
          ["objetivoTratamiento", "Objetivo de tratamiento"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="text-muted mb-1 block">{label}</span>
          <AutoTextarea
            value={values[key]}
            onChange={(ev) =>
              setValues((v) => ({ ...v, [key]: ev.target.value }))
            }
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
