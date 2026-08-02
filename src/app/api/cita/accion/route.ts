import { NextResponse } from "next/server";
import { z } from "zod";

import { hashToken } from "@/lib/auth/tokens";
import { genericTokenErrorMessage } from "@/lib/appointments/tokens";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createClient } from "@supabase/supabase-js";

const BodySchema = z.object({
  token: z.string().min(32).max(128),
  accion: z.enum(["confirmar", "cancelar", "reagendar"]),
  motivo: z.string().trim().max(500).optional(),
  turnstileToken: z.string().optional(),
});

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST ejecuta la acción del token. GET no muta (anti-prefetch de correo).
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`cita:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Intente más tarde." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: genericTokenErrorMessage() },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: genericTokenErrorMessage() },
      { status: 400 },
    );
  }

  // Fail-closed: si Turnstile está configurado, el token es obligatorio.
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!parsed.data.turnstileToken) {
      return NextResponse.json(
        { ok: false, error: genericTokenErrorMessage() },
        { status: 400 },
      );
    }
    const ok = await verifyTurnstile(parsed.data.turnstileToken, ip);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: genericTokenErrorMessage() },
        { status: 400 },
      );
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: genericTokenErrorMessage() },
      { status: 503 },
    );
  }

  const supabase = createClient(url, anon);
  const tokenHash = hashToken(parsed.data.token);

  const { data, error } = await supabase.rpc("consume_appointment_token", {
    p_token_hash: tokenHash,
    p_accion: parsed.data.accion,
    p_motivo: parsed.data.motivo ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: genericTokenErrorMessage() },
      { status: 400 },
    );
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: genericTokenErrorMessage() },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, accion: parsed.data.accion });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST desde la página de confirmación." },
    { status: 405 },
  );
}
