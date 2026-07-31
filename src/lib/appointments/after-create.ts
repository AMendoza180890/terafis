import type { SupabaseClient } from "@supabase/supabase-js";

import { issueAppointmentActionTokens } from "@/lib/appointments/tokens";
import { enqueueCalendarSync } from "@/lib/calendar/sync";
import { enqueueAppointmentReminders } from "@/lib/notifications/enqueue-reminders";
import { buildAdminNotificationBody } from "@/lib/notifications/privacy";
import { notifyStaff } from "@/lib/notifications/service";

/**
 * Efectos secundarios post-creación de cita.
 * Cualquier fallo se registra y no revierte la cita.
 */
export async function afterAppointmentCreated(params: {
  supabase: SupabaseClient;
  clinicId: string;
  appointmentId: string;
  patientId: string;
  terapeutaId: string;
  inicioIso: string;
  finIso: string;
  tipoServicio?: string;
  notasAdmin?: string;
}): Promise<void> {
  const [{ data: patient }, { data: therapist }, { data: clinic }, { data: cfg }] =
    await Promise.all([
      params.supabase
        .from("patients")
        .select(
          "nombre, telefono, email, opt_in_email, opt_in_sms, opt_in_whatsapp, opt_in_push",
        )
        .eq("id", params.patientId)
        .maybeSingle(),
      params.supabase
        .from("staff")
        .select("nombre")
        .eq("id", params.terapeutaId)
        .maybeSingle(),
      params.supabase
        .from("clinics")
        .select("nombre")
        .eq("id", params.clinicId)
        .maybeSingle(),
      params.supabase
        .from("clinic_config")
        .select(
          "recordatorios_email_24h, recordatorios_sms_2h, recordatorios_push_30m, direccion",
        )
        .eq("clinic_id", params.clinicId)
        .maybeSingle(),
    ]);

  const p = patient as {
    nombre: string;
    telefono: string;
    email: string | null;
    opt_in_email: boolean;
    opt_in_sms: boolean;
    opt_in_whatsapp: boolean;
    opt_in_push: boolean;
  } | null;

  const clinicNombre = (clinic as { nombre?: string } | null)?.nombre ?? "Clínica";
  const therNombre = (therapist as { nombre?: string } | null)?.nombre ?? "Terapeuta";

  const copy = buildAdminNotificationBody({
    tipo: "cita_agendada",
    nombrePaciente: p?.nombre,
    hora: params.inicioIso,
    telefono: p?.telefono,
  });

  await notifyStaff(params.supabase, {
    clinicId: params.clinicId,
    tipo: "cita_agendada",
    titulo: copy.titulo,
    cuerpo: copy.cuerpo,
    roleDestino: "recepcionista",
    payload: {
      appointment_id: params.appointmentId,
      patient_id: params.patientId,
    },
  });

  const tokens = await issueAppointmentActionTokens(params.supabase, {
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    inicioUtc: new Date(params.inicioIso),
  });

  const flags = cfg as {
    recordatorios_email_24h?: boolean;
    recordatorios_sms_2h?: boolean;
    recordatorios_push_30m?: boolean;
    direccion?: string | null;
  } | null;

  await enqueueAppointmentReminders(params.supabase, {
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    inicioUtc: new Date(params.inicioIso),
    patientEmail: p?.email,
    patientPhone: p?.telefono,
    optIn: {
      email: p?.opt_in_email ?? false,
      sms: p?.opt_in_sms ?? false,
      whatsapp: p?.opt_in_whatsapp ?? false,
      push: p?.opt_in_push ?? false,
    },
    clinicFlags: {
      email24h: flags?.recordatorios_email_24h ?? true,
      sms2h: flags?.recordatorios_sms_2h ?? true,
      push30m: flags?.recordatorios_push_30m ?? true,
    },
    tokens,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    clinicNombre,
  });

  // Enriquecer payload de email con horarios para link Calendar
  // (las filas ya insertadas; el procesador puede leer appointment)

  await enqueueCalendarSync(params.supabase, {
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    operacion: "upsert",
    terapeutaNombre: therNombre,
    pacienteNombre: p?.nombre ?? "Paciente",
    tipoServicio: params.tipoServicio,
    notasAdmin: params.notasAdmin,
    inicioUtc: params.inicioIso,
    finUtc: params.finIso,
  });
}
