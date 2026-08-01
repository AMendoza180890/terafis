"use server";

import { revalidatePath } from "next/cache";

import { writeAuditError, writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  decryptOptionalText,
  encryptOptionalText,
} from "@/lib/crypto/clinical-fields";
import { RoleCapabilities } from "@/lib/roles";
import {
  CreateSessionNoteSchema,
  ListSessionNotesFilterSchema,
  sessionNoteHasTreatmentPlan,
  UpdateSessionNoteSchema,
} from "@/lib/session-notes/schemas";
import { createClient } from "@/lib/supabase/server";
import { ensureTreatmentPlanFromSessionAction } from "@/lib/treatment-plans/actions";

export type SessionNoteView = {
  id: string;
  patientId: string;
  clinicalId: string | null;
  appointmentId: string | null;
  terapeutaId: string;
  notasEvolucion: string | null;
  tratamiento: string | null;
  observaciones: string | null;
  rangoMovimiento: string | null;
  dolorEva: number | null;
  createdAt: string;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function createSessionNoteAction(raw: unknown): Promise<ActionResult> {
  const parsed = CreateSessionNoteSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "session_note.create",
      tabla: "session_notes",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false, error: "Sin permiso para registrar seguimiento clínico" };
  }

  // Recepción ve el historial, pero no registra/edita seguimiento clínico.
  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Recepción no puede registrar notas de sesión" };
  }

  const input = parsed.data;
  const supabase = await createClient();

  // Validar expediente si el esquema multi-expediente está activo.
  const clinicalCheck = await supabase
    .from("patient_clinical")
    .select("id, estado")
    .eq("id", input.clinicalId)
    .eq("patient_id", input.patientId)
    .maybeSingle();

  let hasClinicalLink = !clinicalCheck.error;
  if (clinicalCheck.error && /clinical_id|estado|column/i.test(clinicalCheck.error.message)) {
    hasClinicalLink = false;
  } else if (!clinicalCheck.error) {
    if (!clinicalCheck.data) {
      return { ok: false, error: "Expediente clínico no encontrado" };
    }
    if ((clinicalCheck.data as { estado?: string }).estado === "cerrado") {
      return {
        ok: false,
        error: "No se pueden agregar seguimientos a un expediente cerrado",
      };
    }
  }

  const planResult = sessionNoteHasTreatmentPlan(input)
    ? await ensureTreatmentPlanFromSessionAction({
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        diagnostico: input.diagnostico,
        objetivo: input.objetivo,
        frecuencia: input.frecuencia,
        duracionEstimadaSemanas: input.duracionEstimadaSemanas,
        ejerciciosDetalle: input.ejerciciosDetalle,
      })
    : null;
  if (planResult && !planResult.ok) {
    return { ok: false, error: planResult.error };
  }

  const baseRow = {
    clinic_id: staff.clinicId,
    patient_id: input.patientId,
    appointment_id: input.appointmentId ?? null,
    terapeuta_id: staff.id,
    notas_evolucion: encryptOptionalText(input.notasEvolucion),
    tratamiento: encryptOptionalText(input.tratamiento),
    observaciones: encryptOptionalText(input.observaciones),
    rango_movimiento: encryptOptionalText(input.rangoMovimiento),
    dolor_eva: input.dolorEva ?? null,
  };

  let insert = await supabase
    .from("session_notes")
    .insert(
      (hasClinicalLink
        ? { ...baseRow, clinical_id: input.clinicalId }
        : baseRow) as never,
    )
    .select("id")
    .single();

  // Esquema legado sin clinical_id
  if (
    insert.error &&
    /clinical_id|column/i.test(insert.error.message) &&
    hasClinicalLink
  ) {
    insert = await supabase
      .from("session_notes")
      .insert(baseRow as never)
      .select("id")
      .single();
  }

  const { data, error } = insert;

  if (error || !data) {
    const msg = error?.message ?? "No se pudo guardar el seguimiento";
    await writeAuditError({
      staff,
      accion: "session_note.create",
      tabla: "session_notes",
      mensaje: msg,
      diff: { patientId: input.patientId, clinicalId: input.clinicalId },
    });
    return { ok: false, error: msg };
  }

  const id = (data as { id: string }).id;
  await writeAuditLog({
    staff,
    accion: "session_note.create",
    tabla: "session_notes",
    registroId: id,
    resultado: "exito",
    mensaje: "Seguimiento de sesión registrado",
    diff: {
      patientId: input.patientId,
      clinicalId: input.clinicalId,
      appointmentId: input.appointmentId ?? null,
    },
  });

  revalidatePath(`/app/pacientes/${input.patientId}`);
  return { ok: true, id };
}

export async function updateSessionNoteAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdateSessionNoteSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "session_note.update",
      tabla: "session_notes",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false, error: "Sin permiso para editar seguimiento clínico" };
  }

  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Recepción solo puede consultar el seguimiento" };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const clinicalCheck = await supabase
    .from("patient_clinical")
    .select("id, estado")
    .eq("id", input.clinicalId)
    .eq("patient_id", input.patientId)
    .maybeSingle();

  const schemaHasClinical =
    !clinicalCheck.error ||
    !/column|estado/i.test(clinicalCheck.error?.message ?? "");

  if (schemaHasClinical && !clinicalCheck.error) {
    if (!clinicalCheck.data) {
      return { ok: false, error: "Expediente clínico no encontrado" };
    }
    if ((clinicalCheck.data as { estado?: string }).estado === "cerrado") {
      return {
        ok: false,
        error: "No se pueden editar seguimientos de un expediente cerrado",
      };
    }
  }

  const { data: existing, error: readError } = await supabase
    .from("session_notes")
    .select("id, terapeuta_id, patient_id")
    .eq("id", input.noteId)
    .eq("patient_id", input.patientId)
    .maybeSingle();

  if (readError || !existing) {
    return { ok: false, error: "Seguimiento no encontrado" };
  }

  const row = existing as {
    id: string;
    terapeuta_id: string;
    patient_id: string;
  };

  if (staff.rol !== "admin" && row.terapeuta_id !== staff.id) {
    return { ok: false, error: "Solo puede editar sus propios seguimientos" };
  }

  const updatePayload: Record<string, unknown> = {
    appointment_id: input.appointmentId ?? null,
    notas_evolucion: encryptOptionalText(input.notasEvolucion),
    tratamiento: encryptOptionalText(input.tratamiento),
    observaciones: encryptOptionalText(input.observaciones),
    rango_movimiento: encryptOptionalText(input.rangoMovimiento),
    dolor_eva: input.dolorEva ?? null,
  };

  let { error } = await supabase
    .from("session_notes")
    .update({ ...updatePayload, clinical_id: input.clinicalId } as never)
    .eq("id", input.noteId);

  if (error && /clinical_id|column/i.test(error.message)) {
    ({ error } = await supabase
      .from("session_notes")
      .update(updatePayload as never)
      .eq("id", input.noteId));
  }

  if (error) {
    await writeAuditError({
      staff,
      accion: "session_note.update",
      tabla: "session_notes",
      mensaje: error.message,
      diff: { noteId: input.noteId },
    });
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "session_note.update",
    tabla: "session_notes",
    registroId: input.noteId,
    resultado: "exito",
    mensaje: "Seguimiento de sesión actualizado",
    diff: {
      patientId: input.patientId,
      clinicalId: input.clinicalId,
      appointmentId: input.appointmentId ?? null,
    },
  });

  revalidatePath(`/app/pacientes/${input.patientId}`);
  return { ok: true, id: input.noteId };
}

export async function listSessionNotesAction(raw: unknown) {
  const parsed = ListSessionNotesFilterSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    return { ok: false as const, error: "Filtros inválidos" };
  }

  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false as const, error: "Sin permiso" };
  }

  const { patientId, clinicalId, desde, hasta, atencion } = parsed.data;
  const supabase = await createClient();

  const selectCols =
    "id, patient_id, appointment_id, terapeuta_id, notas_evolucion, tratamiento, observaciones, rango_movimiento, dolor_eva, created_at";

  async function runQuery(withClinicalCol: boolean) {
    const cols = withClinicalCol
      ? `${selectCols}, clinical_id`
      : selectCols;
    let query = supabase
      .from("session_notes")
      .select(cols as "id")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (withClinicalCol && clinicalId) {
      query = query.or(`clinical_id.eq.${clinicalId},clinical_id.is.null`);
    }
    if (desde) {
      query = query.gte("created_at", `${desde}T00:00:00.000Z`);
    }
    if (hasta) {
      query = query.lte("created_at", `${hasta}T23:59:59.999Z`);
    }
    if (atencion === "none") {
      query = query.is("appointment_id", null);
    } else if (atencion) {
      query = query.eq("appointment_id", atencion);
    }
    return query;
  }

  let result = await runQuery(true);
  if (result.error && /clinical_id|column/i.test(result.error.message)) {
    result = await runQuery(false);
  }

  const { data, error } = result;
  if (error) {
    return { ok: false as const, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "session_note.list",
    tabla: "session_notes",
    registroId: patientId,
    diff: { count: (data ?? []).length, clinicalId, desde, hasta, atencion },
  });

  const notes: SessionNoteView[] = (
    (data ?? []) as unknown as Array<{
      id: string;
      patient_id: string;
      clinical_id?: string | null;
      appointment_id: string | null;
      terapeuta_id: string;
      notas_evolucion: string | null;
      tratamiento: string | null;
      observaciones: string | null;
      rango_movimiento: string | null;
      dolor_eva: number | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    clinicalId: row.clinical_id ?? null,
    appointmentId: row.appointment_id,
    terapeutaId: row.terapeuta_id,
    notasEvolucion: decryptOptionalText(row.notas_evolucion),
    tratamiento: decryptOptionalText(row.tratamiento),
    observaciones: decryptOptionalText(row.observaciones),
    rangoMovimiento: decryptOptionalText(row.rango_movimiento),
    dolorEva: row.dolor_eva,
    createdAt: row.created_at,
  }));

  return { ok: true as const, notes };
}
