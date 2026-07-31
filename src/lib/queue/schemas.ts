import { z } from "zod";

export const QueueStatusSchema = z.enum([
  "pendiente",
  "en_sala_espera",
  "en_consulta",
  "pendiente_pago",
  "completado",
  "no_asistio",
  "cancelado",
]);

export type QueueStatus = z.infer<typeof QueueStatusSchema>;

export const QUEUE_COLUMNS: Array<{
  estado: QueueStatus;
  title: string;
  tone: string;
}> = [
  { estado: "en_consulta", title: "En consulta", tone: "border-accent" },
  { estado: "en_sala_espera", title: "En sala de espera", tone: "border-brand" },
  { estado: "pendiente", title: "Pendientes", tone: "border-brand/25" },
  { estado: "pendiente_pago", title: "Pendiente pago", tone: "border-celeste" },
  { estado: "completado", title: "Completados", tone: "border-verde" },
];

export const UpdateQueueEstadoSchema = z.object({
  queueId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(0),
  nuevoEstado: QueueStatusSchema,
  notas: z.string().max(1000).optional(),
});

export const ReorderQueueSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const FinalizeConsultationSchema = z.object({
  appointmentId: z.string().uuid(),
  queueId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(0),
  items: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        cantidad: z.coerce.number().int().min(1).max(50).default(1),
        notas: z.string().max(500).optional(),
      }),
    )
    .min(1, "Seleccione al menos un servicio"),
});

export type FinalizeConsultationInput = z.infer<typeof FinalizeConsultationSchema>;

export const AddPatientToAttendSchema = z.object({
  patientId: z.string().uuid("Paciente inválido"),
  terapeutaId: z.string().uuid("Terapeuta inválido"),
  salaId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  duracionMinutos: z.coerce.number().int().min(15).max(240).default(60),
  notasAdmin: z.string().trim().max(2000).optional(),
  timezone: z.string().min(1).default("America/Managua"),
});

export type AddPatientToAttendInput = z.infer<typeof AddPatientToAttendSchema>;

/** Transiciones de cola (espejo del RPC). */
export const QUEUE_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  pendiente: ["en_sala_espera", "en_consulta", "cancelado", "no_asistio"],
  en_sala_espera: ["en_consulta", "cancelado", "no_asistio"],
  en_consulta: ["pendiente_pago", "completado", "cancelado"],
  pendiente_pago: ["completado", "cancelado"],
  completado: [],
  no_asistio: [],
  cancelado: [],
};

export function canQueueTransition(from: QueueStatus, to: QueueStatus): boolean {
  return QUEUE_TRANSITIONS[from].includes(to);
}
