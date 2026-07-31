import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNoClinicalPayload } from "@/lib/notifications/privacy";

export async function notifyStaff(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    tipo: string;
    titulo: string;
    cuerpo: string;
    roleDestino?: "admin" | "terapeuta" | "recepcionista" | null;
    staffId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const payload = assertNoClinicalPayload(params.payload ?? {});

  const { error } = await supabase.from("notifications").insert({
    clinic_id: params.clinicId,
    role_destino: params.roleDestino ?? null,
    staff_id: params.staffId ?? null,
    tipo: params.tipo,
    titulo: params.titulo,
    cuerpo: params.cuerpo,
    payload,
  });

  if (error) {
    console.error("notifyStaff falló:", error.message);
  }
}

export async function markNotificationsRead(
  supabase: SupabaseClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("notifications")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .in("id", ids);
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("leida", false);
}
