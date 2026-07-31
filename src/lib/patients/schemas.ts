import { z } from "zod";

export const PatientContactSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre demasiado corto").max(200),
  telefono: z.string().trim().min(7, "Teléfono inválido").max(30),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  contactoEmergenciaNombre: z.string().trim().max(200).optional(),
  contactoEmergenciaTelefono: z.string().trim().max(30).optional(),
  ocupacion: z.string().trim().max(120).optional(),
  optInEmail: z.coerce.boolean().default(false),
  optInSms: z.coerce.boolean().default(false),
  optInWhatsapp: z.coerce.boolean().default(false),
  optInPush: z.coerce.boolean().default(false),
  referidoDoctorId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

export type PatientContactInput = z.infer<typeof PatientContactSchema>;

export const PatientClinicalSchema = z.object({
  titulo: z.string().trim().min(2).max(200).optional(),
  historialMedico: z.string().max(10000).optional(),
  alergias: z.string().max(5000).optional(),
  medicamentos: z.string().max(5000).optional(),
  diagnosticosPrevios: z.string().max(5000).optional(),
  anamnesis: z.string().max(10000).optional(),
  exploracionFisica: z.string().max(10000).optional(),
  diagnosticoFisioterapeutico: z.string().max(5000).optional(),
  objetivoTratamiento: z.string().max(5000).optional(),
});

export type PatientClinicalInput = z.infer<typeof PatientClinicalSchema>;

export const CreateClinicalEpisodeSchema = z.object({
  patientId: z.string().uuid(),
  titulo: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length >= 2 ? v : "Expediente clínico")),
});

export type CreateClinicalEpisodeInput = z.infer<typeof CreateClinicalEpisodeSchema>;

export const UpdateClinicalEpisodeSchema = PatientClinicalSchema.extend({
  clinicalId: z.string().uuid(),
  patientId: z.string().uuid(),
});

export type UpdateClinicalEpisodeInput = z.infer<typeof UpdateClinicalEpisodeSchema>;

export const PatientConsentSchema = z.object({
  tipo: z.enum(["aviso_privacidad", "consentimiento_informado"]),
  versionDocumento: z.string().min(1).max(40),
  textoHash: z.string().min(16).max(128),
});

export const CreatePatientSchema = PatientContactSchema.extend({
  clinical: PatientClinicalSchema.optional(),
  consent: PatientConsentSchema.optional(),
});

export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

export const UpdatePatientContactSchema = PatientContactSchema.extend({
  patientId: z.string().uuid(),
});

export type UpdatePatientContactInput = z.infer<typeof UpdatePatientContactSchema>;

export const SearchPatientsSchema = z.object({
  q: z.string().trim().min(1, "Escriba al menos un carácter").max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
