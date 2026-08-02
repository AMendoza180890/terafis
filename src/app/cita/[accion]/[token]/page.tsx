import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { CitaActionForm } from "@/components/cita/CitaActionForm";
import { hashToken } from "@/lib/auth/tokens";
import { buildAddToGoogleCalendarUrl } from "@/lib/calendar/patient-link";
import { formatInClinicTz, DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { getPublicEnv } from "@/lib/env";

type Props = {
  params: Promise<{ accion: string; token: string }>;
};

const ACCIONES = new Set(["confirmar", "cancelar", "reagendar"]);

export default async function CitaTokenPage({ params }: Props) {
  const { accion, token } = await params;
  if (!ACCIONES.has(accion) || token.length < 32) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-muted">Servicio no disponible.</p>
      </main>
    );
  }

  const supabase = createClient(url, anon);
  const { data } = await supabase.rpc("peek_appointment_token", {
    p_token_hash: hashToken(token),
    p_accion: accion,
  });

  const peek = data as {
    ok?: boolean;
    error?: string;
    inicio?: string;
    fin?: string;
    clinic_nombre?: string;
    clinic_timezone?: string;
    tipo_servicio?: string | null;
  } | null;

  if (!peek?.ok) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-2xl">Enlace no disponible</h1>
        <p className="text-muted mt-2 text-sm">
          El enlace no es válido o ya no está disponible.
        </p>
      </main>
    );
  }

  const timezone = peek.clinic_timezone || DEFAULT_TZ;
  const inicioLabel = peek.inicio
    ? formatInClinicTz(peek.inicio, timezone, "dd/MM/yyyy HH:mm")
    : "";

  const calendarUrl =
    peek.inicio && peek.fin
      ? buildAddToGoogleCalendarUrl({
          clinicNombre: peek.clinic_nombre ?? "Clínica",
          inicioUtc: new Date(peek.inicio),
          finUtc: new Date(peek.fin),
        })
      : null;

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-brand font-serif text-2xl">{peek.clinic_nombre ?? "Terafis"}</p>
      <h1 className="mt-3 text-2xl font-semibold">
        {accion === "confirmar" && "Confirmar asistencia"}
        {accion === "cancelar" && "Cancelar cita"}
        {accion === "reagendar" && "Solicitar reagendar"}
      </h1>
      <p className="text-muted mt-2 text-sm">
        {inicioLabel}
        {peek.tipo_servicio ? ` · ${peek.tipo_servicio}` : ""}
      </p>
      <p className="text-muted mt-4 text-sm">
        Por seguridad, la acción solo se ejecuta al pulsar el botón (no con la apertura
        del correo).
      </p>

      <div className="mt-8">
        <CitaActionForm
          accion={accion as "confirmar" | "cancelar" | "reagendar"}
          token={token}
          turnstileSiteKey={getPublicEnv().turnstileSiteKey}
        />
      </div>

      {calendarUrl && accion === "confirmar" ? (
        <p className="mt-6 text-sm">
          <a
            href={calendarUrl}
            className="text-brand underline"
            target="_blank"
            rel="noreferrer"
          >
            Añadir a Google Calendar
          </a>
        </p>
      ) : null}
    </main>
  );
}
