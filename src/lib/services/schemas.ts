import { z } from "zod";

export const ServiceTipoSchema = z.enum([
  "consulta_evaluacion",
  "consulta_seguimiento",
  "sesion_terapia",
  "paquete_sesiones",
  "producto",
  "estudio_especial",
  "otro",
]);

export type ServiceTipo = z.infer<typeof ServiceTipoSchema>;

export const ServiceSchema = z.object({
  tipo: ServiceTipoSchema,
  titulo: z.string().trim().min(2).max(255),
  descripcion: z.string().trim().max(2000).optional(),
  /** Monto en unidades decimales como string, ej. "600.00" */
  costo: z.string().regex(/^\d+(\.\d{1,2})?$/, "Costo inválido"),
  duracionMinutos: z.coerce.number().int().positive().max(480).optional(),
  requiereAutorizacion: z.coerce.boolean().default(false),
  activo: z.coerce.boolean().default(true),
});

export type ServiceInput = z.infer<typeof ServiceSchema>;

export const UpdateServiceSchema = ServiceSchema.extend({
  id: z.string().uuid(),
});

export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

export const SERVICE_TIPO_OPTIONS = ServiceTipoSchema.options;

export const DEFAULT_SERVICE_CATALOG: Array<{
  tipo: ServiceTipo;
  titulo: string;
  costo: string;
  duracionMinutos: number | null;
}> = [
  {
    tipo: "consulta_evaluacion",
    titulo: "Evaluación inicial",
    costo: "600.00",
    duracionMinutos: 60,
  },
  {
    tipo: "consulta_seguimiento",
    titulo: "Consulta de seguimiento",
    costo: "400.00",
    duracionMinutos: 30,
  },
  {
    tipo: "sesion_terapia",
    titulo: "Sesión de terapia manual",
    costo: "500.00",
    duracionMinutos: 45,
  },
  {
    tipo: "sesion_terapia",
    titulo: "Rehabilitación con equipo",
    costo: "550.00",
    duracionMinutos: 45,
  },
  {
    tipo: "sesion_terapia",
    titulo: "Electroestimulación",
    costo: "350.00",
    duracionMinutos: 30,
  },
  {
    tipo: "paquete_sesiones",
    titulo: "Paquete 5 sesiones",
    costo: "2250.00",
    duracionMinutos: null,
  },
  {
    tipo: "paquete_sesiones",
    titulo: "Paquete 10 sesiones",
    costo: "4000.00",
    duracionMinutos: null,
  },
  {
    tipo: "estudio_especial",
    titulo: "Análisis de movimiento",
    costo: "800.00",
    duracionMinutos: 60,
  },
];
