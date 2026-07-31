"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { encryptField } from "@/lib/crypto/aes-gcm";
import { createClient } from "@/lib/supabase/server";
import {
  CreateTreatmentPlanSchema,
  DEFAULT_PROTOCOLS,
  NewPlanVersionSchema,
} from "@/lib/treatment-plans/schemas";

export type ActionResult =
  { ok: true; id: string; version?: number } | { ok: false; error: string };

function encryptClinical(text: string): string {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) throw new Error("FIELD_ENCRYPTION_KEY no configurada");
  return encryptField(text, key).ciphertext;
}

export async function createTreatmentPlanAction(raw: unknown): Promise<ActionResult> {
  const parsed = CreateTreatmentPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Recepción no gestiona planes clínicos" };
  }

  const supabase = await createClient();
  const terapeutaId = parsed.data.terapeutaId ?? staff.id;

  const { data: plan, error } = await supabase
    .from("treatment_plans")
    .insert({
      clinic_id: staff.clinicId,
      patient_id: parsed.data.patientId,
      terapeuta_id: terapeutaId,
      protocol_id: parsed.data.protocolId ?? null,
      version_actual: 1,
    })
    .select("id")
    .single();

  if (error || !plan)
    return { ok: false, error: error?.message ?? "Error al crear plan" };
  const planId = (plan as { id: string }).id;

  const { data: version, error: vErr } = await supabase
    .from("treatment_plan_versions")
    .insert({
      clinic_id: staff.clinicId,
      plan_id: planId,
      version: 1,
      diagnostico: encryptClinical(parsed.data.diagnostico),
      objetivo: encryptClinical(parsed.data.objetivo),
      frecuencia: parsed.data.frecuencia,
      duracion_estimada_semanas: parsed.data.duracionEstimadaSemanas ?? null,
      creado_por: staff.id,
    })
    .select("id")
    .single();

  if (vErr || !version) {
    return { ok: false, error: vErr?.message ?? "Error al versionar plan" };
  }

  const versionId = (version as { id: string }).id;
  if (parsed.data.exercises.length > 0) {
    await supabase.from("treatment_exercises").insert(
      parsed.data.exercises.map((e, i) => ({
        clinic_id: staff.clinicId,
        plan_version_id: versionId,
        nombre: e.nombre,
        descripcion: e.descripcion ? encryptClinical(e.descripcion) : null,
        series: e.series ?? null,
        repeticiones: e.repeticiones ?? null,
        media_url: e.mediaUrl || null,
        orden: e.orden ?? i,
      })),
    );
  }

  await writeAuditLog({
    staff,
    accion: "treatment_plan.create",
    tabla: "treatment_plans",
    registroId: planId,
    diff: { version: 1, patientId: parsed.data.patientId },
  });

  revalidatePath("/app/planes");
  return { ok: true, id: planId, version: 1 };
}

export async function createPlanVersionAction(raw: unknown): Promise<ActionResult> {
  const parsed = NewPlanVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Sin permiso" };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id, version_actual")
    .eq("id", parsed.data.planId)
    .single();

  if (!plan) return { ok: false, error: "Plan no encontrado" };
  const nextVersion = ((plan as { version_actual: number }).version_actual ?? 1) + 1;

  const { data: version, error } = await supabase
    .from("treatment_plan_versions")
    .insert({
      clinic_id: staff.clinicId,
      plan_id: parsed.data.planId,
      version: nextVersion,
      diagnostico: encryptClinical(parsed.data.diagnostico),
      objetivo: encryptClinical(parsed.data.objetivo),
      frecuencia: parsed.data.frecuencia,
      duracion_estimada_semanas: parsed.data.duracionEstimadaSemanas ?? null,
      creado_por: staff.id,
    })
    .select("id")
    .single();

  if (error || !version) return { ok: false, error: error?.message ?? "Error" };

  const versionId = (version as { id: string }).id;
  if (parsed.data.exercises.length > 0) {
    await supabase.from("treatment_exercises").insert(
      parsed.data.exercises.map((e, i) => ({
        clinic_id: staff.clinicId,
        plan_version_id: versionId,
        nombre: e.nombre,
        descripcion: e.descripcion ? encryptClinical(e.descripcion) : null,
        series: e.series ?? null,
        repeticiones: e.repeticiones ?? null,
        media_url: e.mediaUrl || null,
        orden: e.orden ?? i,
      })),
    );
  }

  await supabase
    .from("treatment_plans")
    .update({
      version_actual: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.planId);

  await writeAuditLog({
    staff,
    accion: "treatment_plan.new_version",
    tabla: "treatment_plans",
    registroId: parsed.data.planId,
    diff: { version: nextVersion },
  });

  revalidatePath("/app/planes");
  revalidatePath(`/app/planes/${parsed.data.planId}`);
  return { ok: true, id: parsed.data.planId, version: nextVersion };
}

export async function seedProtocolsAction(): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") return { ok: false, error: "Solo admin" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("treatment_protocols")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", staff.clinicId);

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Ya hay protocolos" };
  }

  for (const proto of DEFAULT_PROTOCOLS) {
    const { data, error } = await supabase
      .from("treatment_protocols")
      .insert({
        clinic_id: staff.clinicId,
        codigo: proto.codigo,
        titulo: proto.titulo,
        descripcion: proto.descripcion,
      })
      .select("id")
      .single();
    if (error || !data) continue;
    const protocolId = (data as { id: string }).id;
    await supabase.from("protocol_exercises").insert(
      proto.exercises.map((e, i) => ({
        clinic_id: staff.clinicId,
        protocol_id: protocolId,
        nombre: e.nombre,
        descripcion: "descripcion" in e ? e.descripcion : null,
        series: e.series,
        repeticiones: e.repeticiones,
        orden: i,
      })),
    );
  }

  revalidatePath("/app/planes");
  return { ok: true, id: staff.clinicId };
}
