"use server";

import { revalidatePath } from "next/cache";

import { writeAuditError, writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  DEFAULT_SERVICE_CATALOG,
  ServiceSchema,
  UpdateServiceSchema,
} from "@/lib/services/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  { ok: true; id?: string; count?: number } | { ok: false; error: string };

export async function createServiceAction(raw: unknown): Promise<ActionResult> {
  const parsed = ServiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo admin gestiona el catálogo" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      clinic_id: staff.clinicId,
      tipo: parsed.data.tipo,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion ?? null,
      costo: parsed.data.costo,
      duracion_minutos: parsed.data.duracionMinutos ?? null,
      requiere_autorizacion: parsed.data.requiereAutorizacion,
      activo: parsed.data.activo,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "service.create",
    tabla: "services",
    registroId: (data as { id: string }).id,
    diff: { titulo: parsed.data.titulo, costo: parsed.data.costo },
  });

  revalidatePath("/app/servicios");
  return { ok: true, id: (data as { id: string }).id };
}

export async function seedDefaultServicesAction(): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo admin" };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", staff.clinicId);

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Ya existen servicios en el catálogo" };
  }

  const rows = DEFAULT_SERVICE_CATALOG.map((s) => ({
    clinic_id: staff.clinicId,
    tipo: s.tipo,
    titulo: s.titulo,
    costo: s.costo,
    duracion_minutos: s.duracionMinutos,
    activo: true,
  }));

  const { error } = await supabase.from("services").insert(rows);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "service.seed_catalog",
    tabla: "services",
    diff: { count: rows.length },
  });

  revalidatePath("/app/servicios");
  return { ok: true, count: rows.length };
}

export async function toggleServiceActiveAction(
  serviceId: string,
  activo: boolean,
): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo admin" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", serviceId);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "service.toggle_activo",
    tabla: "services",
    registroId: serviceId,
    mensaje: activo ? "Servicio activado" : "Servicio desactivado",
    diff: { activo },
  });

  revalidatePath("/app/servicios");
  return { ok: true, id: serviceId };
}

export async function updateServiceAction(raw: unknown): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo admin gestiona el catálogo" };
  }

  const parsed = UpdateServiceSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "service.update",
      tabla: "services",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .update({
      tipo: input.tipo,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      costo: input.costo,
      duracion_minutos: input.duracionMinutos ?? null,
      requiere_autorizacion: input.requiereAutorizacion,
      activo: input.activo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("clinic_id", staff.clinicId)
    .select("id")
    .maybeSingle();

  if (error) {
    await writeAuditError({
      staff,
      accion: "service.update",
      tabla: "services",
      registroId: input.id,
      mensaje: error.message,
    });
    return { ok: false, error: error.message };
  }

  if (!data) {
    const msg = "Servicio no encontrado o sin permiso";
    await writeAuditError({
      staff,
      accion: "service.update",
      tabla: "services",
      registroId: input.id,
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  await writeAuditLog({
    staff,
    accion: "service.update",
    tabla: "services",
    registroId: input.id,
    resultado: "exito",
    mensaje: "Servicio actualizado",
    diff: {
      titulo: input.titulo,
      tipo: input.tipo,
      costo: input.costo,
      activo: input.activo,
    },
  });

  revalidatePath("/app/servicios");
  return { ok: true, id: input.id };
}
