import type { SupabaseClient } from "@supabase/supabase-js";

import { buildStaffCalendarEventPayload } from "@/lib/calendar/patient-link";
import { assertNoClinicalPayload } from "@/lib/notifications/privacy";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextBackoffMs } from "@/lib/notifications/reminders";

/**
 * Encola sync best-effort. Nunca debe bloquear la creación de la cita.
 */
export async function enqueueCalendarSync(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    appointmentId: string;
    operacion: "upsert" | "delete";
    terapeutaNombre: string;
    pacienteNombre: string;
    tipoServicio?: string | null;
    salaNombre?: string | null;
    notasAdmin?: string | null;
    inicioUtc: string;
    finUtc: string;
  },
): Promise<void> {
  try {
    const payload = assertNoClinicalPayload(
      buildStaffCalendarEventPayload({
        terapeutaNombre: params.terapeutaNombre,
        pacienteNombre: params.pacienteNombre,
        tipoServicio: params.tipoServicio,
        appointmentId: params.appointmentId,
        salaNombre: params.salaNombre,
        notasAdmin: params.notasAdmin,
        inicioUtc: params.inicioUtc,
        finUtc: params.finUtc,
      }),
    );

    await supabase.from("calendar_sync_jobs").insert({
      clinic_id: params.clinicId,
      appointment_id: params.appointmentId,
      operacion: params.operacion,
      payload,
      estado: "pendiente",
    });
  } catch (err) {
    console.error("enqueueCalendarSync (ignorado):", err);
  }
}

/**
 * Procesa cola Google Calendar. Sin credenciales → marca fallido con mensaje
 * y no bloquea el sistema.
 */
export async function processCalendarSyncJobs(limit = 10): Promise<{
  processed: number;
  synced: number;
  failed: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("calendar_sync_jobs")
    .select(
      "id, clinic_id, appointment_id, operacion, payload, intentos, max_intentos, google_event_id",
    )
    .in("estado", ["pendiente", "fallido"])
    .lte("proximo_intento_en", now)
    .order("proximo_intento_en", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return { processed: 0, synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  const configured =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) &&
    Boolean(process.env.GOOGLE_CALENDAR_ID);

  for (const job of data as Array<{
    id: string;
    intentos: number;
    max_intentos: number;
    appointment_id: string;
    payload: Record<string, unknown>;
  }>) {
    if (!configured) {
      await supabase
        .from("calendar_sync_jobs")
        .update({
          estado: "fallido",
          intentos: job.intentos + 1,
          ultimo_error: "Google Calendar no configurado",
          proximo_intento_en: new Date(
            Date.now() + nextBackoffMs(job.intentos + 1),
          ).toISOString(),
          updated_at: now,
        })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    try {
      // Integración real con googleapis se activa cuando hay SA + domain-wide delegation.
      // Aquí dejamos el contrato: éxito simulado solo si hay flag de prueba.
      if (process.env.GOOGLE_CALENDAR_DRY_RUN === "true") {
        const fakeId = `dry_${job.appointment_id.slice(0, 8)}`;
        await supabase
          .from("calendar_sync_jobs")
          .update({
            estado: "sincronizado",
            google_event_id: fakeId,
            updated_at: now,
          })
          .eq("id", job.id);
        await supabase
          .from("appointments")
          .update({ google_event_id: fakeId })
          .eq("id", job.appointment_id);
        synced += 1;
      } else {
        throw new Error(
          "Implementar llamada googleapis con service account (domain-wide delegation)",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      await supabase
        .from("calendar_sync_jobs")
        .update({
          estado: job.intentos + 1 >= job.max_intentos ? "cancelado" : "fallido",
          intentos: job.intentos + 1,
          ultimo_error: msg,
          proximo_intento_en: new Date(
            Date.now() + nextBackoffMs(job.intentos + 1),
          ).toISOString(),
          updated_at: now,
        })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return { processed: data.length, synced, failed };
}
