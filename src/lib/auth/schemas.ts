import { z } from "zod";

import { StaffRoleSchema, ThemePreferenceSchema } from "@/lib/roles";

export const LoginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const StaffProfileSchema = z.object({
  id: z.string().uuid(),
  clinicId: z.string().uuid(),
  authUserId: z.string().uuid(),
  nombre: z.string().min(1),
  email: z.string().email(),
  rol: StaffRoleSchema,
  temaPreferido: ThemePreferenceSchema,
  mfaHabilitado: z.boolean(),
  mfaForzarReinscripcion: z.boolean(),
  activo: z.boolean(),
});

export type StaffProfile = z.infer<typeof StaffProfileSchema>;
