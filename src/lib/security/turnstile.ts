/**
 * Verifica un token de Cloudflare Turnstile contra la API de siteverify.
 * Si TURNSTILE_SECRET_KEY no está configurado, no hay verificación posible
 * (dev/local) y se considera válido; el fail-closed lo decide el caller
 * comprobando la presencia del secret antes de exigir el token.
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: ip,
  });

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}
