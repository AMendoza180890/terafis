/**
 * Link "Añadir a Google Calendar" para el paciente (sin OAuth).
 * El texto no revela motivo clínico.
 */

export function buildAddToGoogleCalendarUrl(params: {
  clinicNombre: string;
  inicioUtc: Date;
  finUtc: Date;
  ubicacion?: string | null;
}): string {
  const text = `Fisioterapia - ${params.clinicNombre}`;
  const details = "Confirmación de cita";
  const dates = `${formatGCalUtc(params.inicioUtc)}/${formatGCalUtc(params.finUtc)}`;

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", text);
  url.searchParams.set("dates", dates);
  url.searchParams.set("details", details);
  if (params.ubicacion) {
    url.searchParams.set("location", params.ubicacion);
  }
  return url.toString();
}

/** Formato Google Calendar: YYYYMMDDTHHmmssZ */
export function formatGCalUtc(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, "");
  return iso.replace(/\.\d{3}Z$/, "Z");
}

export function buildStaffCalendarEventPayload(params: {
  terapeutaNombre: string;
  pacienteNombre: string;
  tipoServicio?: string | null;
  appointmentId: string;
  salaNombre?: string | null;
  notasAdmin?: string | null;
  inicioUtc: string;
  finUtc: string;
}): Record<string, unknown> {
  // Sin diagnóstico ni datos clínicos
  return {
    summary: `[${params.terapeutaNombre}] ${params.pacienteNombre} — ${params.tipoServicio ?? "Consulta"}`,
    description: `Referencia interna #${params.appointmentId}${
      params.notasAdmin ? `\nNotas admin: ${params.notasAdmin}` : ""
    }`,
    location: params.salaNombre ?? undefined,
    start: params.inicioUtc,
    end: params.finUtc,
  };
}
