import { describe, expect, it } from "vitest";

import { rateLimit, resetRateLimitForTests } from "@/lib/security/rate-limit";

describe("rate limit endpoints públicos", () => {
  it("bloquea tras N solicitudes", () => {
    resetRateLimitForTests();
    const key = "test-ip";
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(key, 10, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 10, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
