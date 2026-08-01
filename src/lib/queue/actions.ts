"use server";

import { revalidatePath } from "next/cache";
import { formatInTimeZone } from "date-fns-tz";

import { writeAuditError, writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { findFreeTherapistSlot } from "@/lib/appointments/find-free-slot";
import {
  clinicLocalToUtcIso,
  clinicTodayIso,
  DEFAULT_TZ,
  formatInClinicTz,
} from "@/lib/datetime/clinic-tz";
import {
  AddPatientToAttendSchema,
  FinalizeConsultationSchema,
  ReorderQueueSchema,
  UpdateQueueEstadoSchema,
} from "@/lib/queue/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true; id?: string; total?: number; count?: number }
  | { ok: false; error: string; conflict?: boolean };

function mapRpcError(message: string): ActionResult {
  if (message.includes("VERSION_CONFLICT")) {
    return {
      ok: false,
      conflict: true,
      error: "Otro usuario ya actualizó este registro. Recargue la cola.",
    };
  }
  return { ok: false, error: message };
}

/**
 * Recepcionista/admin: crea cita de hoy y sincroniza la cola del día.
 */
export async function addPatientToAttendAction(raw: unknown): Promise<ActionResult> {
  const parsed = AddPatientToAttendSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "daily_queue.add_patient",
      tabla: "daily_queue",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin permiso para agregar pacientes a la cola" };
  }

  const input = parsed.data;
  const tz = input.timezone || DEFAULT_TZ;
  const now = new Date();
  const fecha = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const hora = formatInTimeZone(now, tz, "HH:mm");
  const desiredInicio = clinicLocalToUtcIso(fecha, hora, tz);

  const supabase = await createClient();

  // Walk-in: sin sala fija para no chocar con EXCLUDE de salas.
  const salaId = input.salaId ?? null;

  const slot = await findFreeTherapistSlot({
    supabase,
    terapeutaId: input.terapeutaId,
    fecha,
    timezone: tz,
    desiredInicioIso: desiredInicio,
    duracionMinutos: input.duracionMinutos,
  });

  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .insert({
      clinic_id: staff.clinicId,
      patient_id: input.patientId,
      terapeuta_id: input.terapeutaId,
      sala_id: salaId,
      inicio: slot.inicio,
      fin: slot.fin,
      estado: "pendiente",
      tipo_servicio: "Atención del día",
      notas_admin: input.notasAdmin ?? "Agregado a cola desde recepción",
    })
    .select("id")
    .single();

  if (apptError || !appt) {
    const msg = apptError?.message ?? "No se pudo crear la cita de hoy";
    await writeAuditError({
      staff,
      accion: "daily_queue.add_patient",
      tabla: "appointments",
      mensaje: msg,
      diff: { patientId: input.patientId, terapeutaId: input.terapeutaId },
    });
    return {
      ok: false,
      error:
        msg.includes("no_solapamiento") || msg.includes("23P01")
          ? "No hay hueco libre para ese terapeuta ahora. Pruebe otro terapeuta."
          : msg,
    };
  }

  const appointmentId = (appt as { id: string }).id;

  try {
    const { afterAppointmentCreated } = await import("@/lib/appointments/after-create");
    await afterAppointmentCreated({
      supabase,
      clinicId: staff.clinicId,
      appointmentId,
      patientId: input.patientId,
      terapeutaId: input.terapeutaId,
      inicioIso: slot.inicio,
      finIso: slot.fin,
      tipoServicio: "Atención del día",
      notasAdmin: input.notasAdmin,
    });
  } catch {
    // best-effort
  }

  const { data: syncCount, error: syncError } = await supabase.rpc("sync_daily_queue", {
    p_fecha: fecha,
  });

  if (syncError) {
    return {
      ok: false,
      error: `Cita creada, pero la cola no sincronizó: ${syncError.message}`,
    };
  }

  await writeAuditLog({
    staff,
    accion: "daily_queue.add_patient",
    tabla: "daily_queue",
    registroId: appointmentId,
    resultado: "exito",
    mensaje: "Paciente agregado a lista de atención",
    diff: {
      patientId: input.patientId,
      terapeutaId: input.terapeutaId,
      fecha,
      hora: formatInClinicTz(slot.inicio, tz, "HH:mm"),
      synced: syncCount,
    },
  });

  revalidatePath("/app/cola");
  revalidatePath(`/app/pacientes/${input.patientId}`);
  return { ok: true, id: appointmentId, count: typeof syncCount === "number" ? syncCount : 0 };
}

export async function syncDailyQueueAction(fecha?: string): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin permiso para sincronizar cola" };
  }

  const supabase = await createClient();
  let pFecha = fecha;
  if (!pFecha) {
    const { data: config } = await supabase
      .from("clinic_config")
      .select("timezone")
      .eq("clinic_id", staff.clinicId)
      .maybeSingle();
    const tz =
      (config as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
    pFecha = clinicTodayIso(tz);
  }
  const { data, error } = await supabase.rpc("sync_daily_queue", {
    p_fecha: pFecha,
  });
  if (error) return mapRpcError(error.message);

  await writeAuditLog({
    staff,
    accion: "daily_queue.sync",
    tabla: "daily_queue",
    diff: { added: data, fecha: fecha ?? "hoy" },
  });

  revalidatePath("/app/cola");
  return { ok: true, count: typeof data === "number" ? data : 0 };
}

export async function updateQueueEstadoAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdateQueueEstadoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  const supabase = await createClient();

  // Fisioterapeuta: solo iniciar su propia consulta (pendiente/sala → en_consulta).
  // Recepción/admin no inician consulta.
  if (parsed.data.nuevoEstado === "en_consulta") {
    if (staff.rol !== "terapeuta") {
      return {
        ok: false,
        error: "Solo el fisioterapeuta puede iniciar la consulta",
      };
    }
    const { data: row } = await supabase
      .from("daily_queue")
      .select("terapeuta_id, estado")
      .eq("id", parsed.data.queueId)
      .maybeSingle();
    const q = row as { terapeuta_id?: string; estado?: string } | null;
    if (!q || q.terapeuta_id !== staff.id) {
      return { ok: false, error: "Solo puede operar sus propios turnos" };
    }
    if (q.estado !== "pendiente" && q.estado !== "en_sala_espera") {
      return {
        ok: false,
        error: "El turno debe estar pendiente o en sala de espera",
      };
    }
  } else if (staff.rol === "terapeuta") {
    return {
      ok: false,
      error: "Solo puede iniciar consulta en sus turnos asignados",
    };
  }

  const { data, error } = await supabase.rpc("update_queue_estado", {
    p_id: parsed.data.queueId,
    p_expected_version: parsed.data.expectedVersion,
    p_nuevo_estado: parsed.data.nuevoEstado,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) return mapRpcError(error.message);

  await writeAuditLog({
    staff,
    accion: "daily_queue.status",
    tabla: "daily_queue",
    registroId: parsed.data.queueId,
    diff: { to: parsed.data.nuevoEstado },
  });

  revalidatePath("/app/cola");
  const id = (data as { id?: string } | null)?.id ?? parsed.data.queueId;
  return { ok: true, id };
}

export async function reorderQueueAction(raw: unknown): Promise<ActionResult> {
  const parsed = ReorderQueueSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Orden inválido" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin permiso" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_daily_queue", {
    p_fecha: parsed.data.fecha,
    p_ordered_ids: parsed.data.orderedIds,
  });

  if (error) return mapRpcError(error.message);

  revalidatePath("/app/cola");
  return { ok: true };
}

export async function finalizeConsultationAction(raw: unknown): Promise<ActionResult> {
  const parsed = FinalizeConsultationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  // Alineado con RPC: solo terapeuta/admin cierran la consulta clínica.
  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Solo el fisioterapeuta puede finalizar la consulta" };
  }

  const supabase = await createClient();
  const items = parsed.data.items.map((i) => ({
    service_id: i.serviceId,
    cantidad: i.cantidad,
    notas: i.notas ?? null,
  }));

  const { data, error } = await supabase.rpc("finalize_consultation", {
    p_appointment_id: parsed.data.appointmentId,
    p_queue_id: parsed.data.queueId,
    p_expected_version: parsed.data.expectedVersion,
    p_items: items,
  });

  if (error) return mapRpcError(error.message);

  const total = Number((data as { total?: number } | null)?.total ?? 0);

  await writeAuditLog({
    staff,
    accion: "appointment.finalize_services",
    tabla: "appointment_services",
    registroId: parsed.data.appointmentId,
    diff: { items: parsed.data.items.length, total },
  });

  revalidatePath("/app/cola");
  return { ok: true, id: parsed.data.appointmentId, total };
}
