"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  ClinicConfigUpdateSchema,
  RoomSchema,
  StaffActiveSchema,
  StaffCreateSchema,
  StaffScheduleSchema,
  StaffUpdateSchema,
} from "@/lib/config/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function updateClinicConfigAction(raw: unknown): Promise<ActionResult> {
  const parsed = ClinicConfigUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo el administrador puede cambiar la configuración" };
  }

  const supabase = await createClient();
  const input = parsed.data;

  if (input.nombre) {
    const { error } = await supabase
      .from("clinics")
      .update({ nombre: input.nombre, updated_at: new Date().toISOString() })
      .eq("id", staff.clinicId);
    if (error) return { ok: false, error: error.message };
  }

  const { error } = await supabase.from("clinic_config").upsert(
    {
      clinic_id: staff.clinicId,
      direccion: input.direccion ?? null,
      telefono: input.telefono ?? null,
      rfc: input.rfc ?? null,
      timezone: input.timezone,
      tema_defecto: input.temaDefecto ?? "sistema",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" },
  );

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "clinic_config.update",
    tabla: "clinic_config",
    registroId: staff.clinicId,
    diff: { timezone: input.timezone },
  });

  revalidatePath("/app/configuracion");
  return { ok: true };
}

export async function createRoomAction(raw: unknown): Promise<ActionResult> {
  const parsed = RoomSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Sala inválida" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo admin puede crear salas" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      clinic_id: staff.clinicId,
      nombre: parsed.data.nombre,
      equipamiento: parsed.data.equipamiento ?? null,
      activa: parsed.data.activa,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/configuracion");
  return { ok: true, id: (data as { id: string }).id };
}

export async function createStaffProfileAction(raw: unknown): Promise<ActionResult> {
  const parsed = StaffCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const actor = await requireCurrentStaff();
  if (actor.rol !== "admin") {
    return { ok: false, error: "Solo admin puede gestionar staff" };
  }

  const input = parsed.data;
  const email = input.email.trim().toLowerCase();
  const supabase = await createClient();

  const { data: existingStaff } = await supabase
    .from("staff")
    .select("id")
    .eq("clinic_id", actor.clinicId)
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingStaff) {
    return { ok: false, error: "Ya existe un miembro del staff con ese correo." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para crear usuarios.",
    };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      nombre: input.nombre,
      rol: input.rol,
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? "No se pudo crear el usuario de acceso";
    if (/already|registered|exists/i.test(msg)) {
      return {
        ok: false,
        error: "Ese correo ya tiene cuenta de acceso. Use otro correo.",
      };
    }
    return { ok: false, error: msg };
  }

  const authUserId = authData.user.id;

  const { data, error } = await supabase
    .from("staff")
    .insert({
      clinic_id: actor.clinicId,
      auth_user_id: authUserId,
      nombre: input.nombre,
      email,
      telefono: input.telefono?.trim() || null,
      rol: input.rol,
      especialidad: input.especialidad?.trim() || null,
      cedula_profesional: input.cedulaProfesional?.trim() || null,
      activo: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    await admin.auth.admin.deleteUser(authUserId);
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff: actor,
    accion: "staff.create",
    tabla: "staff",
    registroId: (data as { id: string }).id,
    diff: { rol: input.rol, email },
  });

  revalidatePath("/app/staff");
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateStaffProfileAction(raw: unknown): Promise<ActionResult> {
  const parsed = StaffUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const actor = await requireCurrentStaff();
  if (actor.rol !== "admin") {
    return { ok: false, error: "Solo admin puede editar staff" };
  }

  const input = parsed.data;
  const email = input.email.trim().toLowerCase();
  const supabase = await createClient();

  const { data: target, error: readError } = await supabase
    .from("staff")
    .select("id, auth_user_id, email, clinic_id")
    .eq("id", input.staffId)
    .eq("clinic_id", actor.clinicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError || !target) {
    return { ok: false, error: "Usuario no encontrado" };
  }

  const row = target as {
    id: string;
    auth_user_id: string;
    email: string;
    clinic_id: string;
  };

  const { data: emailClash } = await supabase
    .from("staff")
    .select("id")
    .eq("clinic_id", actor.clinicId)
    .ilike("email", email)
    .neq("id", input.staffId)
    .is("deleted_at", null)
    .maybeSingle();

  if (emailClash) {
    return { ok: false, error: "Ya existe otro usuario con ese correo." };
  }

  const emailChanged = row.email.toLowerCase() !== email;
  const needsAuthUpdate = emailChanged || Boolean(input.password);

  if (needsAuthUpdate) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return {
        ok: false,
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY para actualizar acceso del usuario.",
      };
    }

    const authPatch: {
      email?: string;
      email_confirm?: boolean;
      password?: string;
      user_metadata?: { nombre: string; rol: string };
    } = {
      user_metadata: { nombre: input.nombre, rol: input.rol },
    };
    if (emailChanged) {
      authPatch.email = email;
      authPatch.email_confirm = true;
    }
    if (input.password) {
      authPatch.password = input.password;
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      row.auth_user_id,
      authPatch,
    );
    if (authError) {
      return { ok: false, error: authError.message };
    }
  }

  const { error } = await supabase
    .from("staff")
    .update({
      nombre: input.nombre,
      email,
      telefono: input.telefono?.trim() || null,
      rol: input.rol,
      especialidad: input.especialidad?.trim() || null,
      cedula_profesional: input.cedulaProfesional?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.staffId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff: actor,
    accion: "staff.update",
    tabla: "staff",
    registroId: input.staffId,
    diff: { rol: input.rol, email, emailChanged },
  });

  revalidatePath("/app/staff");
  return { ok: true, id: input.staffId };
}

export async function setStaffActiveAction(raw: unknown): Promise<ActionResult> {
  const parsed = StaffActiveSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }

  const actor = await requireCurrentStaff();
  if (actor.rol !== "admin") {
    return { ok: false, error: "Solo admin puede desactivar staff" };
  }

  if (parsed.data.staffId === actor.id && !parsed.data.activo) {
    return { ok: false, error: "No puede desactivar su propia cuenta." };
  }

  const supabase = await createClient();
  const { data: target, error: readError } = await supabase
    .from("staff")
    .select("id, auth_user_id, nombre")
    .eq("id", parsed.data.staffId)
    .eq("clinic_id", actor.clinicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError || !target) {
    return { ok: false, error: "Usuario no encontrado" };
  }

  const row = target as { id: string; auth_user_id: string; nombre: string };

  const { error } = await supabase
    .from("staff")
    .update({
      activo: parsed.data.activo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.staffId);

  if (error) {
    return { ok: false, error: error.message };
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(row.auth_user_id, {
      ban_duration: parsed.data.activo ? "none" : "876600h",
    });
  } catch {
    // Si no hay service role, el flag activo ya restringe el acceso en app.
  }

  await writeAuditLog({
    staff: actor,
    accion: parsed.data.activo ? "staff.activate" : "staff.deactivate",
    tabla: "staff",
    registroId: parsed.data.staffId,
    diff: { activo: parsed.data.activo, nombre: row.nombre },
  });

  revalidatePath("/app/staff");
  return { ok: true, id: parsed.data.staffId };
}

export async function addStaffScheduleAction(raw: unknown): Promise<ActionResult> {
  const parsed = StaffScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Horario inválido" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin" && staff.id !== parsed.data.staffId) {
    return { ok: false, error: "Sin permiso" };
  }

  if (parsed.data.horaFin <= parsed.data.horaInicio) {
    return { ok: false, error: "La hora de fin debe ser posterior al inicio" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_schedules")
    .insert({
      clinic_id: staff.clinicId,
      staff_id: parsed.data.staffId,
      dia_semana: parsed.data.diaSemana,
      hora_inicio: `${parsed.data.horaInicio}:00`,
      hora_fin: `${parsed.data.horaFin}:00`,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/staff");
  return { ok: true, id: (data as { id: string }).id };
}

export async function setMfaForceReenrollAction(
  staffId: string,
  force: boolean,
): Promise<ActionResult> {
  const actor = await requireCurrentStaff();
  if (actor.rol !== "admin") {
    return { ok: false, error: "Solo admin" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ mfa_forzar_reinscripcion: force })
    .eq("id", staffId);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff: actor,
    accion: "staff.mfa_force_reenroll",
    tabla: "staff",
    registroId: staffId,
    diff: { force },
  });

  revalidatePath("/app/staff");
  return { ok: true, id: staffId };
}
