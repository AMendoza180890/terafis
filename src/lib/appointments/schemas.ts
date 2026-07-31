import { z } from "zod";

export const AppointmentStatusSchema = z.enum([
  "pendiente",
  "confirmada",
  "en_sala_espera",
  "en_consulta",
  "pendiente_pago",
  "completado",
  "cancelado",
  "no_asistio",
]);

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid("Paciente inválido"),
  terapeutaId: z.string().uuid("Terapeuta inválido"),
  salaId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  duracionMinutos: z.coerce.number().int().min(15).max(240).default(60),
  tipoServicio: z.string().trim().max(120).optional(),
  notasAdmin: z.string().trim().max(2000).optional(),
  timezone: z.string().min(1).default("America/Managua"),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

export const UpdateAppointmentStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  estado: AppointmentStatusSchema,
});

/** Transiciones permitidas (máquina de estados básica Fase 1). */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pendiente: ["confirmada", "en_sala_espera", "cancelado", "no_asistio"],
  confirmada: ["en_sala_espera", "en_consulta", "cancelado", "no_asistio"],
  en_sala_espera: ["en_consulta", "cancelado", "no_asistio"],
  en_consulta: ["pendiente_pago", "completado", "cancelado"],
  pendiente_pago: ["completado", "cancelado"],
  completado: [],
  cancelado: [],
  no_asistio: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
