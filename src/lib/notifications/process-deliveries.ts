import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";
import { nextBackoffMs } from "@/lib/notifications/reminders";
import { buildAddToGoogleCalendarUrl } from "@/lib/calendar/patient-link";

type DeliveryRow = {
  id: string;
  clinic_id: string;
  canal: "email" | "sms" | "whatsapp" | "push" | "in_app";
  plantilla: string;
  destino: string;
  payload: {
    confirm_url?: string | null;
    cancel_url?: string | null;
    clinic_nombre?: string;
    appointment_id?: string;
    inicio?: string;
    fin?: string;
    ubicacion?: string;
  };
  intentos: number;
  max_intentos: number;
};

/**
 * Procesa entregas pendientes (cron). Reintentos con backoff.
 */
export async function processPendingDeliveries(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id, clinic_id, canal, plantilla, destino, payload, intentos, max_intentos")
    .in("estado", ["pendiente", "fallido"])
    .lte("proximo_intento_en", now)
    .lt("intentos", 100)
    .order("proximo_intento_en", { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.error("processPendingDeliveries:", error?.message);
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const row of data as DeliveryRow[]) {
    if (row.intentos >= row.max_intentos) {
      await supabase
        .from("notification_deliveries")
        .update({ estado: "cancelado", updated_at: now })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    await supabase
      .from("notification_deliveries")
      .update({
        estado: "enviando",
        intentos: row.intentos + 1,
        updated_at: now,
      })
      .eq("id", row.id);

    try {
      await deliverOne(row);
      await supabase
        .from("notification_deliveries")
        .update({
          estado: "enviado",
          enviado_en: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ultimo_error: null,
        })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      const backoff = nextBackoffMs(row.intentos + 1);
      const next = new Date(Date.now() + backoff).toISOString();
      const estado = row.intentos + 1 >= row.max_intentos ? "cancelado" : "fallido";
      await supabase
        .from("notification_deliveries")
        .update({
          estado,
          ultimo_error: msg,
          proximo_intento_en: next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return { processed: data.length, sent, failed };
}

async function deliverOne(row: DeliveryRow): Promise<void> {
  if (row.canal === "email") {
    await sendEmailReminder(row);
    return;
  }
  if (row.canal === "sms" || row.canal === "whatsapp") {
    await sendTwilioMessage(row);
    return;
  }
  if (row.canal === "push") {
    // Push del navegador: se materializa vía Realtime/in-app en Fase 3 mínima
    return;
  }
}

async function sendEmailReminder(row: DeliveryRow): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("RESEND no configurado");
  }

  const resend = new Resend(apiKey);
  const clinic = row.payload.clinic_nombre ?? "su clínica";
  const confirm = row.payload.confirm_url ?? "#";
  const cancel = row.payload.cancel_url ?? "#";

  let calendarLink = "";
  if (row.payload.inicio && row.payload.fin) {
    calendarLink = buildAddToGoogleCalendarUrl({
      clinicNombre: clinic,
      inicioUtc: new Date(row.payload.inicio),
      finUtc: new Date(row.payload.fin),
      ubicacion: row.payload.ubicacion,
    });
  }

  const html = `
    <p>Recordatorio de su cita en <strong>${escapeHtml(clinic)}</strong>.</p>
    <p>
      <a href="${confirm}">✅ SÍ, ASISTIRÉ</a>
      &nbsp;|&nbsp;
      <a href="${cancel}">❌ CANCELAR</a>
    </p>
    ${calendarLink ? `<p><a href="${calendarLink}">Añadir a Google Calendar</a></p>` : ""}
    <p style="color:#666;font-size:12px">Este enlace es de un solo uso.</p>
  `;

  const { error } = await resend.emails.send({
    from,
    to: row.destino,
    subject: `Recordatorio de cita — ${clinic}`,
    html,
  });

  if (error) throw new Error(error.message);
}

async function sendTwilioMessage(row: DeliveryRow): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("Twilio no configurado");
  }

  const clinic = row.payload.clinic_nombre ?? "su clínica";
  const confirm = row.payload.confirm_url ?? "";
  const body = `Recordatorio cita ${clinic}. Confirmar: ${confirm}`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: row.destino,
    From: from,
    Body: body.slice(0, 1600),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 200)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
