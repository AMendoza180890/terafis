import { z } from "zod";

export const ReferringDoctorSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre demasiado corto").max(120),
  apellido: z.string().trim().min(2, "Apellido demasiado corto").max(120),
  direccion: z.string().trim().max(300).optional().or(z.literal("")),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  especialidad: z.string().trim().max(120).optional().or(z.literal("")),
  activo: z.coerce.boolean().default(true),
});

export type ReferringDoctorInput = z.infer<typeof ReferringDoctorSchema>;

export const UpdateReferringDoctorSchema = ReferringDoctorSchema.extend({
  id: z.string().uuid(),
});
