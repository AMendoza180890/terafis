type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Rate limit en memoria por clave (IP / token).
 * Suficiente para una instancia; en multi-instancia usar Redis/Edge.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true };
}

/** Solo para tests. */
export function resetRateLimitForTests(): void {
  buckets.clear();
}
