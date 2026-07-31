import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClinicalEpisodeSummary } from "@/lib/patients/actions";

type ClinicalRow = {
  id: string;
  titulo?: string | null;
  estado?: string | null;
  fecha_apertura?: string | null;
  fecha_cierre?: string | null;
  created_at: string;
};

function mapEpisode(row: ClinicalRow): ClinicalEpisodeSummary {
  const createdDate = row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  return {
    id: row.id,
    titulo: row.titulo?.trim() || "Expediente clínico",
    estado: row.estado || "activo",
    fechaApertura: row.fecha_apertura || createdDate,
    fechaCierre: row.fecha_cierre ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Carga expedientes del paciente.
 * Compatible con esquema legado (1:1 sin titulo/estado) y multi-expediente.
 */
export async function loadClinicalEpisodes(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{
  episodes: ClinicalEpisodeSummary[];
  multiExpediente: boolean;
  error: string | null;
}> {
  const modern = await supabase
    .from("patient_clinical")
    .select("id, titulo, estado, fecha_apertura, fecha_cierre, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (!modern.error) {
    return {
      episodes: ((modern.data ?? []) as ClinicalRow[]).map(mapEpisode),
      multiExpediente: true,
      error: null,
    };
  }

  // Columna nueva ausente → esquema legado
  if (/titulo|estado|fecha_apertura|column/i.test(modern.error.message)) {
    const legacy = await supabase
      .from("patient_clinical")
      .select("id, created_at, updated_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (legacy.error) {
      return { episodes: [], multiExpediente: false, error: legacy.error.message };
    }

    return {
      episodes: ((legacy.data ?? []) as ClinicalRow[]).map(mapEpisode),
      multiExpediente: false,
      error: null,
    };
  }

  return { episodes: [], multiExpediente: false, error: modern.error.message };
}

export type PatientClinicalStats = {
  patientId: string;
  expedientes: number;
  seguimientos: number;
};

/** Conteos de expediente/seguimiento para el listado de pacientes. */
export async function loadPatientsClinicalStats(
  supabase: SupabaseClient,
  patientIds: string[],
): Promise<Map<string, PatientClinicalStats>> {
  const map = new Map<string, PatientClinicalStats>();
  for (const id of patientIds) {
    map.set(id, { patientId: id, expedientes: 0, seguimientos: 0 });
  }
  if (patientIds.length === 0) return map;

  const [{ data: clinicals }, { data: notes }] = await Promise.all([
    supabase
      .from("patient_clinical")
      .select("patient_id")
      .in("patient_id", patientIds),
    supabase
      .from("session_notes")
      .select("patient_id")
      .in("patient_id", patientIds),
  ]);

  for (const row of (clinicals ?? []) as Array<{ patient_id: string }>) {
    const cur = map.get(row.patient_id);
    if (cur) cur.expedientes += 1;
  }
  for (const row of (notes ?? []) as Array<{ patient_id: string }>) {
    const cur = map.get(row.patient_id);
    if (cur) cur.seguimientos += 1;
  }

  return map;
}
