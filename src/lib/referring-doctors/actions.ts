"use server";

import { revalidatePath } from "next/cache";

import { writeAuditError, writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  ReferringDoctorSchema,
  UpdateReferringDoctorSchema,
} from "@/lib/referring-doctors/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

function canManage(rol: string) {
  return rol === "admin" || rol === "recepcionista";
}

export async function createReferringDoctorAction(raw: unknown): Promise<ActionResult> {
  const parsed = ReferringDoctorSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "referring_doctor.create",
      tabla: "referring_doctors",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  if (!canManage(staff.rol)) {
    return { ok: false, error: "Sin permiso para gestionar doctores referidos" };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referring_doctors")
    .insert({
      clinic_id: staff.clinicId,
      nombre: input.nombre,
      apellido: input.apellido,
      direccion: input.direccion || null,
      telefono: input.telefono || null,
      especialidad: input.especialidad || null,
      activo: input.activo,
    })
    .select("id")
    .single();

  if (error || !data) {
    const msg = error?.message ?? "No se pudo guardar el doctor";
    await writeAuditError({
      staff,
      accion: "referring_doctor.create",
      tabla: "referring_doctors",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  const id = (data as { id: string }).id;
  await writeAuditLog({
    staff,
    accion: "referring_doctor.create",
    tabla: "referring_doctors",
    registroId: id,
    resultado: "exito",
    mensaje: "Doctor referido creado",
    diff: { nombre: input.nombre, apellido: input.apellido },
  });

  revalidatePath("/app/doctores");
  revalidatePath("/app/pacientes");
  return { ok: true, id };
}

export async function updateReferringDoctorAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdateReferringDoctorSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  if (!canManage(staff.rol)) {
    return { ok: false, error: "Sin permiso para gestionar doctores referidos" };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("referring_doctors")
    .update({
      nombre: input.nombre,
      apellido: input.apellido,
      direccion: input.direccion || null,
      telefono: input.telefono || null,
      especialidad: input.especialidad || null,
      activo: input.activo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "referring_doctor.update",
    tabla: "referring_doctors",
    registroId: input.id,
    resultado: "exito",
    mensaje: "Doctor referido actualizado",
  });

  revalidatePath("/app/doctores");
  revalidatePath("/app/pacientes");
  return { ok: true, id: input.id };
}

export async function deactivateReferringDoctorAction(id: string): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (!canManage(staff.rol)) {
    return { ok: false, error: "Sin permiso" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("referring_doctors")
    .update({
      activo: false,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "referring_doctor.deactivate",
    tabla: "referring_doctors",
    registroId: id,
  });

  revalidatePath("/app/doctores");
  return { ok: true, id };
}

export async function listReferringDoctorsAction(activeOnly = true) {
  await requireCurrentStaff();
  const supabase = await createClient();
  let query = supabase
    .from("referring_doctors")
    .select("id, nombre, apellido, direccion, telefono, especialidad, activo")
    .is("deleted_at", null)
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (activeOnly) {
    query = query.eq("activo", true);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    doctors: (data ?? []) as Array<{
      id: string;
      nombre: string;
      apellido: string;
      direccion: string | null;
      telefono: string | null;
      especialidad: string | null;
      activo: boolean;
    }>,
  };
}
