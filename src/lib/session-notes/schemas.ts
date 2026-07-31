import { z } from "zod";

export const CreateSessionNoteSchema = z.object({
  patientId: z.string().uuid("Paciente inválido"),
  clinicalId: z.string().uuid("Expediente inválido"),
  appointmentId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  notasEvolucion: z.string().trim().max(10000).optional(),
  tratamiento: z.string().trim().max(10000).optional(),
  observaciones: z.string().trim().max(10000).optional(),
  rangoMovimiento: z.string().trim().max(5000).optional(),
  dolorEva: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().int().min(0).max(10).optional()),
});

export type CreateSessionNoteInput = z.infer<typeof CreateSessionNoteSchema>;

export const UpdateSessionNoteSchema = CreateSessionNoteSchema.extend({
  noteId: z.string().uuid("Nota inválida"),
});

export type UpdateSessionNoteInput = z.infer<typeof UpdateSessionNoteSchema>;

export const ListSessionNotesFilterSchema = z.object({
  patientId: z.string().uuid(),
  clinicalId: z.string().uuid().optional(),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  /** UUID de cita, o "none" para notas sin atención asociada. */
  atencion: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

export type ListSessionNotesFilter = z.infer<typeof ListSessionNotesFilterSchema>;
