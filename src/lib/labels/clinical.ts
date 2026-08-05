/**
 * Labels de expediente clínico (UI).
 * Mantener aquí para que alta de paciente y panel clínico no diverjan.
 */
export const CLINICAL_FIELD_LABELS = {
  titulo: "Título / motivo",
  historialMedico: "Historial médico",
  alergias: "Alergias",
  medicamentos: "Medicamentos de base",
  diagnosticosPrevios: "Diagnósticos previos",
  anamnesis: "Escala de VASS (0-10)",
  exploracionFisica: "Exploración física",
  diagnosticoFisioterapeutico: "Diagnóstico fisioterapéutico",
  objetivoTratamiento: "Tratamiento Fisioterapeutico",
} as const;

export type ClinicalFieldKey = keyof typeof CLINICAL_FIELD_LABELS;
