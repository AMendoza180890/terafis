import type { SupabaseClient } from "@supabase/supabase-js";

import { addMinutesIso, clinicLocalToUtcIso } from "@/lib/datetime/clinic-tz";

type Busy = { inicio: string; fin: string };

function overlaps(startMs: number, endMs: number, busy: Busy): boolean {
  const bi = new Date(busy.inicio).getTime();
  const bf = new Date(busy.fin).getTime();
  return startMs < bf && endMs > bi;
}

/**
 * Busca un hueco libre para el terapeuta en el día civil de la clínica.
 * Evita chocar con citas activas (incl. completadas mientras el EXCLUDE las cuente).
 */
export async function findFreeTherapistSlot(params: {
  supabase: SupabaseClient;
  terapeutaId: string;
  fecha: string;
  timezone: string;
  desiredInicioIso: string;
  duracionMinutos: number;
}): Promise<{ inicio: string; fin: string }> {
  const {
    supabase,
    terapeutaId,
    fecha,
    timezone,
    desiredInicioIso,
    duracionMinutos,
  } = params;

  const dayStart = clinicLocalToUtcIso(fecha, "00:00", timezone);
  const nextDay = addMinutesIso(
    clinicLocalToUtcIso(fecha, "23:59", timezone),
    2,
  );

  const { data } = await supabase
    .from("appointments")
    .select("inicio, fin")
    .eq("terapeuta_id", terapeutaId)
    .not("estado", "in", "(cancelado,no_asistio)")
    .lt("inicio", nextDay)
    .gt("fin", dayStart)
    .order("inicio", { ascending: true });

  const busy = (data ?? []) as Busy[];
  const durationMs = Math.max(5, duracionMinutos) * 60_000;
  let candidate = new Date(desiredInicioIso);

  for (let attempt = 0; attempt < 96; attempt++) {
    const startMs = candidate.getTime();
    const endMs = startMs + durationMs;
    const hit = busy.find((b) => overlaps(startMs, endMs, b));
    if (!hit) {
      return {
        inicio: candidate.toISOString(),
        fin: new Date(endMs).toISOString(),
      };
    }
    const afterHit = new Date(hit.fin).getTime();
    candidate = new Date(Math.max(afterHit, startMs + 5 * 60_000));
  }

  // Último recurso: 15 minutos después del último bloqueo.
  const lastEnd = busy.reduce((max, b) => {
    const t = new Date(b.fin).getTime();
    return t > max ? t : max;
  }, new Date(desiredInicioIso).getTime());
  const inicio = new Date(lastEnd).toISOString();
  return { inicio, fin: addMinutesIso(inicio, Math.min(duracionMinutos, 30)) };
}
