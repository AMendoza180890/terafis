import { z } from "zod";

/**
 * Variables públicas (prefijo NEXT_PUBLIC_*).
 * Son las ÚNICAS que el bundle del navegador puede leer.
 * Nunca poner secretos aquí.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublic: PublicEnv | null = null;

export function getPublicEnv(): {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  turnstileSiteKey: string | undefined;
} {
  if (!cachedPublic) {
    const parsed = publicEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY:
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
    });

    if (!parsed.success) {
      // En cliente/servidor: valores vacíos si faltan (createClient lanza).
      return {
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
      };
    }
    cachedPublic = parsed.data;
  }

  return {
    appUrl: cachedPublic.NEXT_PUBLIC_APP_URL,
    supabaseUrl: cachedPublic.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: cachedPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    turnstileSiteKey: cachedPublic.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
}
