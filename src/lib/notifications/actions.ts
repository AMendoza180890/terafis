"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/notifications/service";
import { createClient } from "@/lib/supabase/server";

export async function markReadAction(ids: string[]) {
  await requireCurrentStaff();
  const supabase = await createClient();
  await markNotificationsRead(supabase, ids);
  revalidatePath("/app");
  return { ok: true as const };
}

export async function clearAllNotificationsAction() {
  const staff = await requireCurrentStaff();
  const supabase = await createClient();
  await markAllNotificationsRead(supabase, staff.clinicId);
  revalidatePath("/app");
  return { ok: true as const };
}
