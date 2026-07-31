import { z } from "zod";

/**
 * Variables de entorno validadas con Zod.
 * Solo importar desde código de servidor (nunca en el cliente).
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(1).optional(),
  SEARCH_HMAC_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
    SEARCH_HMAC_KEY: process.env.SEARCH_HMAC_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  cached = parsed.data;
  return cached;
}

export function getPublicEnv() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}
