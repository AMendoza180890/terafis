"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  ChangePasswordSchema,
  UpdateOwnProfileSchema,
} from "@/lib/profile/schemas";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionResult =
  | { ok: true; avatarUrl?: string | null }
  | { ok: false; error: string };

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function updateOwnProfileAction(
  raw: unknown,
): Promise<ProfileActionResult> {
  const parsed = UpdateOwnProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  const supabase = await createClient();
  const input = parsed.data;

  const { error } = await supabase
    .from("staff")
    .update({
      nombre: input.nombre,
      telefono: input.telefono || null,
      especialidad: input.especialidad || null,
      cedula_profesional: input.cedulaProfesional || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.id);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "profile.update",
    tabla: "staff",
    registroId: staff.id,
    mensaje: "Perfil actualizado",
    diff: { fields: ["nombre", "telefono", "especialidad", "cedula"] },
  });

  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  const staff = await requireCurrentStaff();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Seleccione una imagen" };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "Solo JPEG, PNG o WebP" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "La imagen no debe superar 2 MB" };
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${staff.clinicId}/${staff.id}/avatar.${ext}`;
  const supabase = await createClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("staff-avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await supabase
    .from("staff")
    .update({
      avatar_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.id);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "profile.avatar_update",
    tabla: "staff",
    registroId: staff.id,
    mensaje: "Foto de perfil actualizada",
  });

  const { data: signed } = await supabase.storage
    .from("staff-avatars")
    .createSignedUrl(path, 60 * 60);

  revalidatePath("/app", "layout");
  return { ok: true, avatarUrl: signed?.signedUrl ?? null };
}

export async function changePasswordAction(
  raw: unknown,
): Promise<ProfileActionResult> {
  const parsed = ChangePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: staff.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return { ok: false, error: "La contraseña actual no es correcta" };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "profile.password_change",
    tabla: "staff",
    registroId: staff.id,
    mensaje: "Contraseña actualizada",
  });

  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  try {
    const staff = await requireCurrentStaff();
    await writeAuditLog({
      staff,
      accion: "auth.sign_out",
      tabla: "staff",
      registroId: staff.id,
      mensaje: "Cierre de sesión",
      resultado: "info",
    });
  } catch {
    // sin sesión staff: igual cerrar auth
  }
  await supabase.auth.signOut();
  redirect("/login");
}

