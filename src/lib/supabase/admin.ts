import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";

/**
 * Cliente con service role — BYPASS RLS.
 * Usar solo en jobs de servidor, Edge Functions o bootstrap.
 * Nunca exponer al cliente ni usar en rutas de usuario autenticado.
 */
export function createAdminClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada.");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
