import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/** Cliente Supabase para el navegador (respeta RLS con la sesión del usuario). */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
