import type { SupabaseClient } from "@supabase/supabase-js";

import type { IssuedToken } from "@/lib/appointments/tokens";
import { assertNoClinicalPayload } from "@/lib/notifications/privacy";
import { computeReminderWindows, filterByOptIn } from "@/lib/notifications/reminders";

/**
 * Encola entregas de recordatorio según opt-in del paciente y flags de clínica.
 * Best-effort: no lanza si falla el insert.
 */
export async function enqueueAppointmentReminders(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    appointmentId: string;
    patientId: string;
    inicioUtc: Date;
    patientEmail?: string | null;
    patientPhone?: string | null;
    optIn: { email: boolean; sms: boolean; whatsapp: boolean; push: boolean };
    clinicFlags: { email24h: boolean; sms2h: boolean; push30m: boolean };
    tokens: IssuedToken[];
    appUrl: string;
    clinicNombre: string;
  },
): Promise<number> {
  const windows = filterByOptIn(
    computeReminderWindows(params.inicioUtc),
    params.optIn,
    params.clinicFlags,
  );

  const confirm = params.tokens.find((t) => t.accion === "confirmar");
  const cancel = params.tokens.find((t) => t.accion === "cancelar");

  let count = 0;
  for (const w of windows) {
    let destino: string | null = null;
    if (w.canal === "email") destino = params.patientEmail ?? null;
    if (w.canal === "sms" || w.canal === "whatsapp") {
      destino = params.patientPhone ?? null;
    }
    if (w.canal === "push") destino = params.patientId; // canal push por paciente

    if (!destino) continue;

    const payload = assertNoClinicalPayload({
      appointment_id: params.appointmentId,
      clinic_nombre: params.clinicNombre,
      confirm_url: confirm ? `${params.appUrl}${confirm.urlPath}` : null,
      cancel_url: cancel ? `${params.appUrl}${cancel.urlPath}` : null,
      add_to_calendar: true,
    });

    const { error } = await supabase.from("notification_deliveries").insert({
      clinic_id: params.clinicId,
      appointment_id: params.appointmentId,
      patient_id: params.patientId,
      canal: w.canal === "whatsapp" ? "whatsapp" : w.canal,
      plantilla: w.plantilla,
      destino,
      payload,
      estado: "pendiente",
      proximo_intento_en: w.sendAt.toISOString(),
    });

    if (!error) count += 1;
    else console.error("enqueue reminder:", error.message);
  }

  return count;
}
