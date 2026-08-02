import type { EventInput } from "@fullcalendar/core";

import { AgendaCalendar } from "@/components/appointments/AgendaCalendar";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { StatusButtons } from "@/components/appointments/StatusButtons";
import type { AppointmentStatus } from "@/lib/appointments/schemas";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { DEFAULT_TZ, formatInClinicTz } from "@/lib/datetime/clinic-tz";
import { requireMenuAccess } from "@/lib/permissions/require";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Agenda — Terafis" };

type ApptRow = {
  id: string;
  inicio: string;
  fin: string;
  estado: AppointmentStatus;
  tipo_servicio: string | null;
  patient_id: string;
  terapeuta_id: string;
};

export default async function AgendaPage() {
  const staff = await getCurrentStaff();
  await requireMenuAccess(staff, "agenda");
  const canAssign = !!staff && RoleCapabilities[staff.rol].asignarCitasYCola;
  let timezone = DEFAULT_TZ;
  let patients: { id: string; label: string }[] = [];
  let therapists: { id: string; label: string }[] = [];
  let events: EventInput[] = [];
  let upcoming: Array<ApptRow & { patientNombre: string; terapeutaNombre: string }> = [];

  if (staff) {
    const supabase = await createClient();
    const [{ data: cfg }, { data: pats }, { data: ther }, { data: appts }] =
      await Promise.all([
        supabase
          .from("clinic_config")
          .select("timezone")
          .eq("clinic_id", staff.clinicId)
          .maybeSingle(),
        supabase
          .from("patients")
          .select("id, nombre")
          .is("deleted_at", null)
          .order("nombre"),
        supabase
          .from("staff")
          .select("id, nombre")
          .eq("rol", "terapeuta")
          .eq("activo", true)
          .is("deleted_at", null)
          .order("nombre"),
        supabase
          .from("appointments")
          .select("id, inicio, fin, estado, tipo_servicio, patient_id, terapeuta_id")
          .order("inicio", { ascending: true })
          .limit(200),
      ]);

    timezone = (cfg as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;

    const patientMap = new Map(
      ((pats ?? []) as Array<{ id: string; nombre: string }>).map((p) => [
        p.id,
        p.nombre,
      ]),
    );
    const therapistMap = new Map(
      ((ther ?? []) as Array<{ id: string; nombre: string }>).map((t) => [
        t.id,
        t.nombre,
      ]),
    );

    patients = [...patientMap.entries()].map(([id, label]) => ({ id, label }));
    therapists = [...therapistMap.entries()].map(([id, label]) => ({ id, label }));

    const rows = (appts ?? []) as ApptRow[];
    upcoming = rows.slice(0, 30).map((a) => ({
      ...a,
      patientNombre: patientMap.get(a.patient_id) ?? "Paciente",
      terapeutaNombre: therapistMap.get(a.terapeuta_id) ?? "Terapeuta",
    }));

    events = rows
      .filter((a) => a.estado !== "cancelado" && a.estado !== "no_asistio")
      .map((a) => ({
        id: a.id,
        title: `${patientMap.get(a.patient_id) ?? "Paciente"} — ${therapistMap.get(a.terapeuta_id) ?? "Terapeuta"}`,
        start: a.inicio,
        end: a.fin,
      }));
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Agenda</h1>
        <p className="text-muted mt-1 text-sm">
          {canAssign
            ? "Calendario por terapeuta. Sin doble reserva a nivel de base de datos."
            : "Vista de calendario. Solo recepción puede asignar o cambiar citas."}
        </p>
      </div>

      <div className={canAssign ? "grid gap-8 lg:grid-cols-[1fr_340px]" : "grid gap-8"}>
        <AgendaCalendar events={events} timezone={timezone} />
        {canAssign ? (
          <div className="border-brand/15 bg-surface rounded-xl border p-5">
            <AppointmentForm
              patients={patients}
              therapists={therapists}
              timezone={timezone}
            />
          </div>
        ) : null}
      </div>

      <section className="border-brand/15 bg-surface rounded-xl border p-5">
        <h2 className="font-semibold">Próximas citas</h2>
        <ul className="mt-4 space-y-3">
          {upcoming.length === 0 ? (
            <li className="text-muted text-sm">No hay citas cargadas.</li>
          ) : (
            upcoming.map((a) => (
              <li
                key={a.id}
                className="border-brand/5 flex flex-col gap-3 border-b pb-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {a.patientNombre} · {a.terapeutaNombre}
                  </p>
                  <p className="text-muted">
                    {formatInClinicTz(a.inicio, timezone)} · {a.estado}
                    {a.tipo_servicio ? ` · ${a.tipo_servicio}` : ""}
                  </p>
                </div>
                {canAssign ? (
                  <StatusButtons appointmentId={a.id} estado={a.estado} />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
