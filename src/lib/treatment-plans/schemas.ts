import { z } from "zod";

/** Detalle libre de ejercicios, series y repeticiones (textarea). */
export const EjerciciosDetalleSchema = z
  .string()
  .trim()
  .min(1, "Indique ejercicios, series y repeticiones")
  .max(10000);

export const TreatmentPlanFieldsSchema = z.object({
  diagnostico: z.string().trim().min(1, "Diagnóstico requerido").max(5000),
  objetivo: z.string().trim().min(1, "Objetivo requerido").max(5000),
  frecuencia: z.string().trim().min(1, "Frecuencia requerida").max(80),
  duracionEstimadaSemanas: z.coerce
    .number()
    .int()
    .positive()
    .max(104)
    .optional(),
  ejerciciosDetalle: EjerciciosDetalleSchema,
});

export type TreatmentPlanFieldsInput = z.infer<typeof TreatmentPlanFieldsSchema>;

/** Convierte el texto libre en una fila de ejercicio para la BD. */
export function ejerciciosDetalleToRows(detalle: string) {
  return [
    {
      nombre: "Ejercicios, series y repeticiones",
      descripcion: detalle,
      series: undefined as number | undefined,
      repeticiones: undefined as number | undefined,
      mediaUrl: "" as string | undefined,
      orden: 0,
    },
  ];
}

/** Reconstruye el textarea desde filas de ejercicios (legado o formato nuevo). */
export function exercisesToDetalle(
  exercises: Array<{
    nombre: string;
    descripcion?: string | null;
    series?: number | null;
    repeticiones?: number | null;
  }>,
): string {
  if (exercises.length === 0) return "";
  if (
    exercises.length === 1 &&
    exercises[0]!.nombre === "Ejercicios, series y repeticiones"
  ) {
    return exercises[0]!.descripcion?.trim() ?? "";
  }
  return exercises
    .map((e) => {
      const parts = [e.nombre];
      if (e.series != null || e.repeticiones != null) {
        parts.push(
          `${e.series ?? "—"} series × ${e.repeticiones ?? "—"} repeticiones`,
        );
      }
      if (e.descripcion?.trim()) parts.push(e.descripcion.trim());
      return parts.join(" — ");
    })
    .join("\n");
}

export const CreateTreatmentPlanSchema = TreatmentPlanFieldsSchema.extend({
  patientId: z.string().uuid(),
  terapeutaId: z.string().uuid().optional(),
  protocolId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  /** Cita de la atención: enlaza el plan para factura/comprobante. */
  appointmentId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

export type CreateTreatmentPlanInput = z.infer<typeof CreateTreatmentPlanSchema>;

export const NewPlanVersionSchema = TreatmentPlanFieldsSchema.extend({
  planId: z.string().uuid(),
});

export type NewPlanVersionInput = z.infer<typeof NewPlanVersionSchema>;

export const DEFAULT_PROTOCOLS = [
  {
    codigo: "lumbalgia",
    titulo: "Lumbalgia mecánica",
    descripcion: "Protocolo base de estabilización lumbar",
    exercises: [
      {
        nombre: "Ejercicios, series y repeticiones",
        descripcion:
          "Puente de glúteos: 3 series × 12 repeticiones — Activación glútea en decúbito.\nBird-dog: 3 series × 10 repeticiones — Control motor en cuadrupedia.",
      },
    ],
  },
  {
    codigo: "hombro_congelado",
    titulo: "Hombro congelado",
    descripcion: "Movilidad progresiva de hombro",
    exercises: [
      {
        nombre: "Ejercicios, series y repeticiones",
        descripcion:
          "Péndulos de Codman: 2 series × 20 repeticiones.\nDeslizamiento en pared: 3 series × 10 repeticiones.",
      },
    ],
  },
  {
    codigo: "esguince_tobillo",
    titulo: "Esguince de tobillo",
    descripcion: "Propiocepción y carga progresiva",
    exercises: [
      {
        nombre: "Ejercicios, series y repeticiones",
        descripcion:
          "Equilibrio unipodal: 3 series × 30 s.\nBanda elástica eversión: 3 series × 15 repeticiones.",
      },
    ],
  },
] as const;
