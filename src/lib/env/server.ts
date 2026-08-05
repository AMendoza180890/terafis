import "server-only";

import { z } from "zod";

const base64Key32 = z
  .string()
  .min(1)
  .refine((v) => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "debe ser 32 bytes en base64");

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  FIELD_ENCRYPTION_KEY: base64Key32.optional(),
  SEARCH_HMAC_KEY: base64Key32.optional(),
  CRON_SECRET: z.string().min(32).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional(),
  GOOGLE_CALENDAR_ID: z.string().min(1).optional(),
  GOOGLE_WORKSPACE_DELEGATED_USER: z.string().email().optional(),
  GOOGLE_CALENDAR_DRY_RUN: z.enum(["true", "false"]).optional(),
});

const productionServerEnvSchema = serverEnvSchema
  .required({
    SUPABASE_SERVICE_ROLE_KEY: true,
    FIELD_ENCRYPTION_KEY: true,
    SEARCH_HMAC_KEY: true,
    // CRON_SECRET opcional: Vercel Hobby no incluye Cron; el endpoint
    // /api/cron/reminders solo se usa si invoca un scheduler externo.
  })
  .superRefine((data, ctx) => {
    if (data.CRON_SECRET && data.CRON_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "Si define CRON_SECRET, debe tener al menos 32 caracteres",
      });
    }
    const strictHost =
      process.env.TERAFIS_STRICT_ENV === "1" || process.env.VERCEL_ENV === "production";

    if (strictHost) {
      if (!data.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_APP_URL"],
          message: "En producción debe ser HTTPS (no localhost)",
        });
      }
      if (/localhost|127\.0\.0\.1/i.test(data.NEXT_PUBLIC_APP_URL)) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_APP_URL"],
          message: "En producción no use localhost",
        });
      }
    }

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith("NEXT_PUBLIC_") || !value) continue;
      if (
        key.includes("SERVICE_ROLE") ||
        key.includes("DATABASE") ||
        key.includes("ENCRYPTION") ||
        key.includes("HMAC") ||
        key.includes("SECRET") ||
        key.includes("PRIVATE")
      ) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Variable sensible no debe usar prefijo NEXT_PUBLIC_: ${key}`,
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

function readRawEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY || undefined,
    SEARCH_HMAC_KEY: process.env.SEARCH_HMAC_KEY || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || undefined,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || undefined,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || undefined,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || undefined,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || undefined,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || undefined,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || undefined,
    GOOGLE_WORKSPACE_DELEGATED_USER:
      process.env.GOOGLE_WORKSPACE_DELEGATED_USER || undefined,
    GOOGLE_CALENDAR_DRY_RUN: process.env.GOOGLE_CALENDAR_DRY_RUN || undefined,
  };
}

/**
 * Variables de entorno de servidor. Nunca importar desde componentes cliente.
 * En producción exige cifrado, service role y CRON_SECRET.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  if (process.env.SKIP_ENV_VALIDATION === "1") {
    cached = serverEnvSchema.parse(readRawEnv());
    return cached;
  }

  const isProd = process.env.NODE_ENV === "production";
  const schema = isProd ? productionServerEnvSchema : serverEnvSchema;
  const parsed = schema.safeParse(readRawEnv());

  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas (${isProd ? "producción" : "desarrollo"}): ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Valida entorno al arrancar el proceso (instrumentation). */
export function assertServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION === "1") return;
  getServerEnv();
}
