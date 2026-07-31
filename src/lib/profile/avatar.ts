import { createClient } from "@/lib/supabase/server";

/** URL firmada de corta duración para mostrar el avatar en UI. */
export async function getAvatarSignedUrl(
  avatarPath: string | null | undefined,
): Promise<string | null> {
  if (!avatarPath) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("staff-avatars")
      .createSignedUrl(avatarPath, 60 * 60);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
