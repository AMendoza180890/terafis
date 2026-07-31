import { z } from "zod";

import { ThemePreferenceSchema } from "@/lib/roles";
import { CEDULA_NI_PATTERN } from "@/lib/validation/cedula-ni";

export const ClinicConfigUpdateSchema = z.object({
  nombre: z.string().trim().min(2).max(200).optional(),
  direccion: z.string().trim().max(300).optional(),
  telefono: z.string().trim().max(40).optional(),
  rfc: z.string().trim().max(20).optional(),
  timezone: z.string().trim().min(1).max(64),
  temaDefecto: ThemePreferenceSchema.optional(),
});

export type ClinicConfigUpdateInput = z.infer<typeof ClinicConfigUpdateSchema>;

export const RoomSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  equipamiento: z.string().trim().max(500).optional(),
  activa: z.coerce.boolean().default(true),
});

export type RoomInput = z.infer<typeof RoomSchema>;

export const CedulaNiSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => CEDULA_NI_PATTERN.test(v), {
    message: "Cédula inválida. Use el formato 000-000000-0000A",
  });

/** Vacío permitido; si hay valor, debe cumplir la máscara NI. */
export const CedulaNiOptionalSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v.toUpperCase()))
  .refine((v) => v === undefined || CEDULA_NI_PATTERN.test(v), {
    message: "Cédula inválida. Use el formato 000-000000-0000A",
  });

export const StaffCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(200),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  telefono: z.string().trim().max(40).optional(),
  rol: z.enum(["admin", "terapeuta", "recepcionista"]),
  especialidad: z.string().trim().max(120).optional(),
  cedulaProfesional: CedulaNiOptionalSchema,
});

export type StaffCreateInput = z.infer<typeof StaffCreateSchema>;

export const StaffUpdateSchema = z
  .object({
    staffId: z.string().uuid(),
    nombre: z.string().trim().min(2).max(200),
    email: z.string().email("Correo inválido"),
    telefono: z.string().trim().max(40).optional(),
    rol: z.enum(["admin", "terapeuta", "recepcionista"]),
    especialidad: z.string().trim().max(120).optional(),
    cedulaProfesional: CedulaNiOptionalSchema,
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const pwd = data.password?.trim() ?? "";
    if (pwd.length > 0 && pwd.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "La contraseña debe tener al menos 8 caracteres",
      });
    }
  })
  .transform((data) => ({
    ...data,
    password:
      data.password && data.password.trim().length > 0
        ? data.password.trim()
        : undefined,
  }));

export type StaffUpdateInput = z.infer<typeof StaffUpdateSchema>;

export const StaffActiveSchema = z.object({
  staffId: z.string().uuid(),
  activo: z.boolean(),
});

export type StaffActiveInput = z.infer<typeof StaffActiveSchema>;

export const StaffScheduleSchema = z.object({
  staffId: z.string().uuid(),
  diaSemana: z.coerce.number().int().min(0).max(6),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
});
