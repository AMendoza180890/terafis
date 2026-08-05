import { describe, expect, it } from "vitest";

import { resolveColorScheme, resolveThemePreference } from "@/lib/theme/resolution";

describe("precedencia de tema (4.10)", () => {
  it("preferencia staff > tema clínica > sistema", () => {
    expect(resolveThemePreference("oscuro", "claro")).toBe("oscuro");
    expect(resolveThemePreference("claro", "oscuro")).toBe("claro");
    expect(resolveThemePreference("sistema", "oscuro")).toBe("oscuro");
    expect(resolveThemePreference("sistema", "sistema")).toBe("sistema");
    expect(resolveThemePreference(null, "claro")).toBe("claro");
    expect(resolveThemePreference(undefined, undefined)).toBe("sistema");
  });

  it("resuelve esquema con OS cuando preferencia es sistema", () => {
    expect(resolveColorScheme("sistema", true)).toBe("oscuro");
    expect(resolveColorScheme("sistema", false)).toBe("claro");
    expect(resolveColorScheme("claro", true)).toBe("claro");
    expect(resolveColorScheme("oscuro", false)).toBe("oscuro");
  });
});
