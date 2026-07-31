import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

/** Cliente Supabase para Server Components / Route Handlers (RLS activo). */
export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // set desde Server Component de solo lectura — el middleware refresca la sesión.
        }
      },
    },
  });
}
