/**
 * Labels del plan de tratamiento (UI).
 * Usados en atención, manager de planes y detalle de versión.
 */
export const TREATMENT_PLAN_FIELD_LABELS = {
  diagnostico: "Diagnóstico fisioterapéutico",
  objetivo: "Objetivo",
  frecuencia: "Frecuencia (ej. 2x/semana)",
  duracionSemanas: "Duración (semanas)",
  ejerciciosDetalle: "Recomendaciones y contra indicaciones",
} as const;

export const TREATMENT_PLAN_PLACEHOLDERS = {
  ejerciciosDetalle:
    "Ej.\nEvitar cargas > 5 kg las primeras 2 semanas\nAplicar frío 15 min tras ejercicio\nNo forzar flexión máxima si hay dolor > 5",
} as const;

export type TreatmentPlanFieldKey = keyof typeof TREATMENT_PLAN_FIELD_LABELS;
