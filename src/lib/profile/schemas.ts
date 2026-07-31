import { z } from "zod";

export const UpdateOwnProfileSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre demasiado corto").max(120),
  telefono: z.string().trim().max(40).optional().or(z.literal("")),
  especialidad: z.string().trim().max(120).optional().or(z.literal("")),
  cedulaProfesional: z.string().trim().max(60).optional().or(z.literal("")),
});

export type UpdateOwnProfileInput = z.infer<typeof UpdateOwnProfileSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Indique su contraseña actual"),
    newPassword: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Za-z]/, "Debe incluir una letra")
      .regex(/[0-9]/, "Debe incluir un número"),
    confirmPassword: z.string().min(1, "Confirme la contraseña"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "La nueva contraseña debe ser distinta",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
