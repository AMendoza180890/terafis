import { z } from "zod";

/** Roles de staff — alineados con el enum de PostgreSQL. */
export const StaffRoleSchema = z.enum(["admin", "terapeuta", "recepcionista"]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const ThemePreferenceSchema = z.enum(["claro", "oscuro", "sistema"]);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

/** Minutos de inactividad por rol (§2.5). */
export function inactivityMinutesForRole(
  role: StaffRole,
  config?: { recepcion: number; staff: number },
): number {
  const recepcion = config?.recepcion ?? 15;
  const staff = config?.staff ?? 30;
  return role === "recepcionista" ? recepcion : staff;
}

/** MFA obligatorio por defecto para admin y terapeuta. */
export function requiresMfa(
  role: StaffRole,
  config?: {
    admin: boolean;
    terapeuta: boolean;
    recepcionista: boolean;
  },
): boolean {
  const defaults = {
    admin: true,
    terapeuta: true,
    recepcionista: false,
    ...config,
  };
  return defaults[role];
}

/** Matriz de capacidades de alto nivel (la autorización real es RLS). */
export const RoleCapabilities = {
  admin: {
    verExpedienteClinico: true,
    verPagos: true,
    gestionarStaff: true,
    verAuditLog: true,
    exportarReportes: true,
    /** Agendar citas, meter a cola y operar estados de cola. */
    asignarCitasYCola: true,
  },
  terapeuta: {
    verExpedienteClinico: true,
    verPagos: false,
    gestionarStaff: false,
    verAuditLog: false,
    exportarReportes: false,
    /** Solo consulta visual de agenda/cola; no asigna ni opera turnos. */
    asignarCitasYCola: false,
  },
  recepcionista: {
    verExpedienteClinico: true,
    verPagos: true,
    gestionarStaff: false,
    verAuditLog: false,
    exportarReportes: false,
    asignarCitasYCola: true,
  },
} as const satisfies Record<
  StaffRole,
  {
    verExpedienteClinico: boolean;
    verPagos: boolean;
    gestionarStaff: boolean;
    verAuditLog: boolean;
    exportarReportes: boolean;
    asignarCitasYCola: boolean;
  }
>;
