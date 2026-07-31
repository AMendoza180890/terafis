"use server";

import { revalidatePath } from "next/cache";

import {
  canTransition,
  CreateAppointmentSchema,
  UpdateAppointmentStatusSchema,
  type AppointmentStatus,
} from "@/lib/appointments/schemas";
import { writeAuditError, writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { addMinutesIso, clinicLocalToUtcIso } from "@/lib/datetime/clinic-tz";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

function isOverlapError(message: string): boolean {
  return (
    message.includes("no_solapamiento") ||
    message.includes("exclusion") ||
    message.includes("23P01") ||
    message.toLowerCase().includes("overlap")
  );
}

export async function createAppointmentAction(raw: unknown): Promise<ActionResult> {
  const parsed = CreateAppointmentSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "appointment.create",
      tabla: "appointments",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  const input = parsed.data;

  // Recepción/admin: cualquier terapeuta. Fisio: solo citas asignadas a sí mismo
  // (p. ej. siguiente control desde la atención).
  if (staff.rol === "terapeuta" && input.terapeutaId !== staff.id) {
    return {
      ok: false,
      error: "Solo puede agendar citas asignadas a usted",
    };
  }

  const inicio = clinicLocalToUtcIso(input.fecha, input.hora, input.timezone);
  const fin = addMinutesIso(inicio, input.duracionMinutos);

  const supabase = await createClient();

  // Solo asignar sala si el usuario la eligió; auto-asignar provoca
  // conflictos por no_solapamiento_sala con citas ya cerradas.
  const salaId = input.salaId ?? null;

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: staff.clinicId,
      patient_id: input.patientId,
      terapeuta_id: input.terapeutaId,
      sala_id: salaId,
      inicio,
      fin,
      estado: "pendiente",
      tipo_servicio: input.tipoServicio ?? null,
      notas_admin: input.notasAdmin ?? null,
    })
    .select("id")
    .single();

  if (error) {
    const msg = isOverlapError(error.message)
      ? "Horario no disponible: el terapeuta (o la sala) ya tiene una cita en ese intervalo. Elija otra hora."
      : error.message;
    await writeAuditError({
      staff,
      accion: "appointment.create",
      tabla: "appointments",
      mensaje: msg,
      diff: { patientId: input.patientId, terapeutaId: input.terapeutaId },
    });
    return { ok: false, error: msg };
  }

  const id = (data as { id: string }).id;
  await writeAuditLog({
    staff,
    accion: "appointment.create",
    tabla: "appointments",
    registroId: id,
    resultado: "exito",
    mensaje: "Cita agendada",
    diff: { patientId: input.patientId, terapeutaId: input.terapeutaId, inicio },
  });

  // Fase 3: notificaciones / tokens / recordatorios / calendar — best-effort
  try {
    const { afterAppointmentCreated } = await import("@/lib/appointments/after-create");
    await afterAppointmentCreated({
      supabase,
      clinicId: staff.clinicId,
      appointmentId: id,
      patientId: input.patientId,
      terapeutaId: input.terapeutaId,
      inicioIso: inicio,
      finIso: fin,
      tipoServicio: input.tipoServicio,
      notasAdmin: input.notasAdmin,
    });
  } catch (err) {
    console.error("afterAppointmentCreated (ignorado):", err);
  }

  revalidatePath("/app/agenda");
  return { ok: true, id };
}

export async function updateAppointmentStatusAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdateAppointmentStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Transición inválida" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Solo recepción puede cambiar el estado de citas" };
  }

  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("appointments")
    .select("id, estado")
    .eq("id", parsed.data.appointmentId)
    .single();

  if (readError || !current) {
    return { ok: false, error: "Cita no encontrada" };
  }

  const from = (current as { estado: AppointmentStatus }).estado;
  const to = parsed.data.estado;
  if (!canTransition(from, to)) {
    return { ok: false, error: `No se puede pasar de ${from} a ${to}` };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ estado: to, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.appointmentId);

  if (error) {
    if (isOverlapError(error.message)) {
      return {
        ok: false,
        error: "Conflicto de horario al reactivar la cita.",
      };
    }
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "appointment.status_change",
    tabla: "appointments",
    registroId: parsed.data.appointmentId,
    diff: { from, to },
  });

  revalidatePath("/app/agenda");
  return { ok: true, id: parsed.data.appointmentId };
}
