import { z } from "zod";

import { TreatmentPlanFieldsSchema } from "@/lib/treatment-plans/schemas";

const SessionNoteBaseSchema = z.object({
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

/** Plan opcional: si se inicia, deben completarse los campos obligatorios del plan. */
function refineOptionalPlan(
  data: {
    diagnostico?: string;
    objetivo?: string;
    frecuencia?: string;
    ejerciciosDetalle?: string;
    duracionEstimadaSemanas?: number;
  },
  ctx: z.RefinementCtx,
) {
  const started = Boolean(
    data.diagnostico?.trim() ||
      data.objetivo?.trim() ||
      data.frecuencia?.trim() ||
      data.ejerciciosDetalle?.trim() ||
      data.duracionEstimadaSemanas != null,
  );
  if (!started) return;

  const plan = TreatmentPlanFieldsSchema.safeParse({
    diagnostico: data.diagnostico ?? "",
    objetivo: data.objetivo ?? "",
    frecuencia: data.frecuencia ?? "",
    duracionEstimadaSemanas: data.duracionEstimadaSemanas,
    ejerciciosDetalle: data.ejerciciosDetalle ?? "",
  });
  if (!plan.success) {
    ctx.addIssue({
      code: "custom",
      message:
        plan.error.issues[0]?.message ??
        "Complete el plan de tratamiento o déjelo vacío",
      path: ["ejerciciosDetalle"],
    });
  }
}

export const CreateSessionNoteSchema = SessionNoteBaseSchema.merge(
  TreatmentPlanFieldsSchema.partial(),
).superRefine(refineOptionalPlan);

export type CreateSessionNoteInput = z.infer<typeof CreateSessionNoteSchema>;

export const UpdateSessionNoteSchema = SessionNoteBaseSchema.extend({
  noteId: z.string().uuid("Nota inválida"),
})
  .merge(TreatmentPlanFieldsSchema.partial())
  .superRefine(refineOptionalPlan);

export type UpdateSessionNoteInput = z.infer<typeof UpdateSessionNoteSchema>;

/** Indica si el payload trae un plan listo para guardar. */
export function sessionNoteHasTreatmentPlan(data: {
  diagnostico?: string;
  objetivo?: string;
  frecuencia?: string;
  ejerciciosDetalle?: string;
  duracionEstimadaSemanas?: number;
}): boolean {
  return TreatmentPlanFieldsSchema.safeParse({
    diagnostico: data.diagnostico ?? "",
    objetivo: data.objetivo ?? "",
    frecuencia: data.frecuencia ?? "",
    duracionEstimadaSemanas: data.duracionEstimadaSemanas,
    ejerciciosDetalle: data.ejerciciosDetalle ?? "",
  }).success;
}

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
