import type { QueueStatus } from "@/lib/queue/schemas";

export type QueueItemView = {
  id: string;
  appointmentId: string;
  patientId: string;
  patientNombre: string;
  patientTelefono: string | null;
  terapeutaId: string;
  terapeutaNombre: string;
  salaNombre: string | null;
  fecha: string;
  horaCita: string;
  horaInicioAtencion: string | null;
  horaFinAtencion: string | null;
  tipoServicio: string | null;
  estado: QueueStatus;
  prioridad: number;
  posicionCola: number;
  version: number;
  notasRecepcion: string | null;
  totalPendiente: string | null;
  /** Servicios aplicados (útil en pendiente_pago / completado). */
  serviciosResumen: string[];
};
