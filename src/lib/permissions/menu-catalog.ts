import type { StaffRole } from "@/lib/roles";

export const MENU_KEYS = [
  "inicio",
  "pacientes",
  "doctores",
  "agenda",
  "cola",
  "servicios",
  "caja",
  "inventario",
  "reportes",
  "planes",
  "staff",
  "auditoria",
  "configuracion",
  "permisos",
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export type MenuCatalogItem = {
  key: MenuKey;
  label: string;
  href: string;
};

export const MENU_CATALOG: MenuCatalogItem[] = [
  { key: "inicio", label: "Inicio", href: "/app" },
  { key: "pacientes", label: "Pacientes", href: "/app/pacientes" },
  { key: "doctores", label: "Doctores", href: "/app/doctores" },
  { key: "agenda", label: "Agenda", href: "/app/agenda" },
  { key: "cola", label: "Cola", href: "/app/cola" },
  { key: "servicios", label: "Servicios", href: "/app/servicios" },
  { key: "caja", label: "Caja", href: "/app/caja" },
  { key: "inventario", label: "Inventario", href: "/app/inventario" },
  { key: "reportes", label: "Reportes", href: "/app/reportes" },
  { key: "planes", label: "Planes", href: "/app/planes" },
  { key: "staff", label: "Staff", href: "/app/staff" },
  { key: "auditoria", label: "Auditoría", href: "/app/auditoria" },
  { key: "configuracion", label: "Configuración", href: "/app/configuracion" },
  { key: "permisos", label: "Permisos", href: "/app/permisos" },
];

/** Defaults de código (si la BD aún no tiene filas seed). */
export const CODE_ROLE_MENU_DEFAULTS: Record<StaffRole, MenuKey[]> = {
  admin: [...MENU_KEYS],
  recepcionista: MENU_KEYS.filter(
    (k) => !["planes", "staff", "auditoria", "permisos"].includes(k),
  ),
  terapeuta: MENU_KEYS.filter(
    (k) =>
      ![
        "doctores",
        "caja",
        "inventario",
        "reportes",
        "planes",
        "staff",
        "auditoria",
        "permisos",
      ].includes(k),
  ),
};

export function isMenuKey(value: string): value is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(value);
}

/** Mapea un pathname de la app a la clave de menú (o null si no aplica). */
export function menuKeyFromPathname(pathname: string): MenuKey | null {
  if (pathname === "/app" || pathname === "/app/") return "inicio";
  const sorted = [...MENU_CATALOG]
    .filter((i) => i.key !== "inicio")
    .sort((a, b) => b.href.length - a.href.length);
  for (const item of sorted) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.key;
    }
  }
  return null;
}

export function resolveEffectiveMenuKeys(input: {
  role: StaffRole;
  roleDefaults: Partial<Record<MenuKey, boolean>>;
  overrides: Partial<Record<MenuKey, boolean>>;
}): Set<MenuKey> {
  const result = new Set<MenuKey>();
  for (const key of MENU_KEYS) {
    if (key === "inicio") {
      result.add("inicio");
      continue;
    }
    // Admin siempre conserva gestión de permisos.
    if (key === "permisos" && input.role === "admin") {
      result.add("permisos");
      continue;
    }
    const override = input.overrides[key];
    if (override !== undefined) {
      if (override) result.add(key);
      continue;
    }
    const roleAllowed =
      input.roleDefaults[key] ??
      CODE_ROLE_MENU_DEFAULTS[input.role].includes(key);
    if (roleAllowed) result.add(key);
  }
  return result;
}

export function staffHasMenuAccess(
  effectiveKeys: readonly MenuKey[],
  key: MenuKey | null,
): boolean {
  if (key == null) return true;
  if (key === "inicio") return true;
  return effectiveKeys.includes(key);
}
