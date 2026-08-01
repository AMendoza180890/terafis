import { describe, expect, it } from "vitest";

import {
  menuKeyFromPathname,
  resolveEffectiveMenuKeys,
} from "@/lib/permissions/menu-catalog";

describe("resolveEffectiveMenuKeys", () => {
  it("hereda defaults del rol", () => {
    const keys = resolveEffectiveMenuKeys({
      role: "terapeuta",
      roleDefaults: { pacientes: true, caja: false, agenda: true },
      overrides: {},
    });
    expect(keys.has("inicio")).toBe(true);
    expect(keys.has("pacientes")).toBe(true);
    expect(keys.has("agenda")).toBe(true);
    expect(keys.has("caja")).toBe(false);
  });

  it("override allow añade opción denegada por rol", () => {
    const keys = resolveEffectiveMenuKeys({
      role: "terapeuta",
      roleDefaults: { caja: false, pacientes: true },
      overrides: { caja: true },
    });
    expect(keys.has("caja")).toBe(true);
  });

  it("override deny quita opción permitida por rol", () => {
    const keys = resolveEffectiveMenuKeys({
      role: "recepcionista",
      roleDefaults: { caja: true, pacientes: true },
      overrides: { caja: false },
    });
    expect(keys.has("caja")).toBe(false);
    expect(keys.has("pacientes")).toBe(true);
  });

  it("admin siempre conserva permisos", () => {
    const keys = resolveEffectiveMenuKeys({
      role: "admin",
      roleDefaults: { permisos: false },
      overrides: { permisos: false },
    });
    expect(keys.has("permisos")).toBe(true);
  });
});

describe("menuKeyFromPathname", () => {
  it("mapea rutas anidadas", () => {
    expect(menuKeyFromPathname("/app")).toBe("inicio");
    expect(menuKeyFromPathname("/app/caja")).toBe("caja");
    expect(menuKeyFromPathname("/app/caja/pagos/abc")).toBe("caja");
    expect(menuKeyFromPathname("/app/pacientes/uuid")).toBe("pacientes");
  });
});
