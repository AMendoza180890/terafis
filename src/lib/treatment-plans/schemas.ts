import { z } from "zod";

export const ExerciseSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().max(5000).optional(),
  series: z.coerce.number().int().positive().max(50).optional(),
  repeticiones: z.coerce.number().int().positive().max(500).optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  orden: z.coerce.number().int().min(0).default(0),
});

export const CreateTreatmentPlanSchema = z.object({
  patientId: z.string().uuid(),
  terapeutaId: z.string().uuid().optional(),
  protocolId: z.string().uuid().optional(),
  diagnostico: z.string().trim().min(1).max(5000),
  objetivo: z.string().trim().min(1).max(5000),
  frecuencia: z.string().trim().min(1).max(80),
  duracionEstimadaSemanas: z.coerce.number().int().positive().max(104).optional(),
  exercises: z.array(ExerciseSchema).default([]),
});

export type CreateTreatmentPlanInput = z.infer<typeof CreateTreatmentPlanSchema>;

export const NewPlanVersionSchema = z.object({
  planId: z.string().uuid(),
  diagnostico: z.string().trim().min(1).max(5000),
  objetivo: z.string().trim().min(1).max(5000),
  frecuencia: z.string().trim().min(1).max(80),
  duracionEstimadaSemanas: z.coerce.number().int().positive().max(104).optional(),
  exercises: z.array(ExerciseSchema).default([]),
});

export const DEFAULT_PROTOCOLS = [
  {
    codigo: "lumbalgia",
    titulo: "Lumbalgia mecánica",
    descripcion: "Protocolo base de estabilización lumbar",
    exercises: [
      {
        nombre: "Puente de glúteos",
        series: 3,
        repeticiones: 12,
        descripcion: "Activación glútea en decúbito",
      },
      {
        nombre: "Bird-dog",
        series: 3,
        repeticiones: 10,
        descripcion: "Control motor en cuadrupedia",
      },
    ],
  },
  {
    codigo: "hombro_congelado",
    titulo: "Hombro congelado",
    descripcion: "Movilidad progresiva de hombro",
    exercises: [
      {
        nombre: "Péndulos de Codman",
        series: 2,
        repeticiones: 20,
      },
      {
        nombre: "Deslizamiento en pared",
        series: 3,
        repeticiones: 10,
      },
    ],
  },
  {
    codigo: "esguince_tobillo",
    titulo: "Esguince de tobillo",
    descripcion: "Propiocepción y carga progresiva",
    exercises: [
      {
        nombre: "Equilibrio unipodal",
        series: 3,
        repeticiones: 30,
      },
      {
        nombre: "Banda elástica eversión",
        series: 3,
        repeticiones: 15,
      },
    ],
  },
] as const;
