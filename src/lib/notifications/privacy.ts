const CLINICAL_KEYS = [
  "diagnostico",
  "diagnóstico",
  "historial",
  "alergia",
  "medicamento",
  "anamnesis",
  "exploracion",
  "exploración",
  "motivo_medico",
  "motivoMedico",
  "notas_evolucion",
  "notasEvolucion",
  "objetivo_tratamiento",
] as const;

/**
 * Garantiza que payloads de notificación / calendar / SMS
 * no contengan claves clínicas (§11, §14).
 */
export function assertNoClinicalPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(payload)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "");
    if (CLINICAL_KEYS.some((c) => normalized.includes(c.replace(/[_-]/g, "")))) {
      throw new Error(`Payload de notificación no puede incluir campo clínico: ${key}`);
    }
  }
  return payload;
}

export function buildAdminNotificationBody(params: {
  tipo: string;
  nombrePaciente?: string;
  hora?: string;
  telefono?: string;
  monto?: string;
  motivo?: string;
}): { titulo: string; cuerpo: string } {
  switch (params.tipo) {
    case "cita_agendada":
      return {
        titulo: "Nuevo paciente agendado",
        cuerpo:
          `${params.nombrePaciente ?? "Paciente"} — ${params.hora ?? ""} — ${params.telefono ?? ""}`.trim(),
      };
    case "cita_cancelada_paciente":
      return {
        titulo: "Paciente canceló cita",
        cuerpo: `${params.nombrePaciente ?? "Paciente"} — ${params.hora ?? ""} — Motivo: ${params.motivo ?? "No especificado"}`,
      };
    case "pago_pendiente":
      return {
        titulo: "Pago pendiente",
        cuerpo: `Cobrar C$ ${params.monto ?? "?"} — ${params.nombrePaciente ?? "Paciente"}`,
      };
    default:
      return { titulo: "Aviso", cuerpo: "Actualización administrativa" };
  }
}
