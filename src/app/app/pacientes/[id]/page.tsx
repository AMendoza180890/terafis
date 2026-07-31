import { notFound } from "next/navigation";

import { ClinicalEpisodesWorkspace } from "@/components/patients/ClinicalEpisodesWorkspace";
import { ContactEditForm } from "@/components/patients/ContactEditForm";
import { NextAppointmentPanel } from "@/components/patients/NextAppointmentPanel";
import { AddToAttendPanel } from "@/components/queue/AddToAttendPanel";
import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import {
  clinicTodayIso,
  formatInClinicTz,
  DEFAULT_TZ,
} from "@/lib/datetime/clinic-tz";
import type { ClinicalEpisodeSummary } from "@/lib/patients/actions";
import { loadClinicalEpisodes } from "@/lib/patients/clinical-episodes";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clinicalId?: string }>;
};

export default async function PacienteDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { clinicalId: clinicalIdParam } = await searchParams;
  const staff = await getCurrentStaff();
  if (!staff) {
    return <p className="text-muted">Inicie sesión para ver la ficha del paciente.</p>;
  }

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, nombre, telefono, email, fecha_nacimiento, contacto_emergencia_nombre, contacto_emergencia_telefono, ocupacion, referido_doctor_id, opt_in_email, opt_in_sms, opt_in_whatsapp, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!patient) notFound();

  const p = patient as {
    id: string;
    nombre: string;
    telefono: string;
    email: string | null;
    fecha_nacimiento: string | null;
    contacto_emergencia_nombre: string | null;
    contacto_emergencia_telefono: string | null;
    ocupacion: string | null;
    referido_doctor_id: string | null;
    opt_in_email: boolean;
    opt_in_sms: boolean;
    opt_in_whatsapp: boolean;
    created_at: string;
  };

  const canFinalizeConsultation =
    staff.rol === "terapeuta" || staff.rol === "admin";

  const { data: config } = await supabase
    .from("clinic_config")
    .select("timezone")
    .eq("clinic_id", staff.clinicId)
    .maybeSingle();

  const tz = (config as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
  const fechaHoy = clinicTodayIso(tz);

  const [
    { data: appointments },
    { data: therapists },
    { data: doctors },
    { data: activeQueue },
    { data: serviceRows },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, inicio, fin, estado, tipo_servicio")
      .eq("patient_id", id)
      .order("inicio", { ascending: false })
      .limit(40),
    supabase
      .from("staff")
      .select("id, nombre")
      .eq("rol", "terapeuta")
      .eq("activo", true)
      .is("deleted_at", null)
      .order("nombre"),
    supabase
      .from("referring_doctors")
      .select("id, nombre, apellido, especialidad, telefono, activo")
      .is("deleted_at", null)
      .order("apellido", { ascending: true }),
    canFinalizeConsultation
      ? supabase
          .from("daily_queue")
          .select("id, appointment_id, version, terapeuta_id, estado")
          .eq("patient_id", id)
          .eq("fecha", fechaHoy)
          .in("estado", ["pendiente", "en_sala_espera", "en_consulta"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canFinalizeConsultation
      ? supabase
          .from("services")
          .select("id, titulo, costo")
          .eq("activo", true)
          .order("titulo")
      : Promise.resolve({ data: null }),
  ]);

  const clinicalLoad = RoleCapabilities[staff.rol].verExpedienteClinico
    ? await loadClinicalEpisodes(supabase, id)
    : { episodes: [] as ClinicalEpisodeSummary[], multiExpediente: false, error: null };

  const canClinical = RoleCapabilities[staff.rol].verExpedienteClinico;
  const canWriteClinical = canClinical;
  const canWriteSessionNotes =
    staff.rol === "admin" || staff.rol === "terapeuta";
  const canManageEpisodes =
    canWriteSessionNotes && clinicalLoad.multiExpediente;

  const queueRow = activeQueue as {
    id: string;
    appointment_id: string;
    version: number;
    terapeuta_id: string;
    estado: "pendiente" | "en_sala_espera" | "en_consulta";
  } | null;

  const activeConsultation =
    queueRow &&
    (staff.rol === "admin" || queueRow.terapeuta_id === staff.id)
      ? {
          queueId: queueRow.id,
          appointmentId: queueRow.appointment_id,
          version: queueRow.version,
          patientNombre: p.nombre,
          estado: queueRow.estado,
        }
      : null;

  const services = (
    (serviceRows ?? []) as Array<{
      id: string;
      titulo: string;
      costo: string | number;
    }>
  ).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    costo: String(s.costo),
  }));

  const apptRows = (appointments ?? []) as Array<{
    id: string;
    inicio: string;
    estado: string;
    tipo_servicio: string | null;
  }>;

  const appointmentOpts = apptRows.map((a) => ({
    id: a.id,
    label: `${formatInClinicTz(a.inicio, tz)} — ${a.tipo_servicio ?? "Consulta"} (${a.estado})`,
  }));

  const doctorRows = (doctors ?? []) as Array<{
    id: string;
    nombre: string;
    apellido: string;
    especialidad: string | null;
    telefono: string | null;
    activo?: boolean;
  }>;
  const referringDoctorOpts = doctorRows.map((d) => ({
    id: d.id,
    label: d.especialidad
      ? `${d.apellido}, ${d.nombre} — ${d.especialidad}`
      : `${d.apellido}, ${d.nombre}`,
  }));
  const referido = doctorRows.find((d) => d.id === p.referido_doctor_id);

  const clinicalEpisodes = clinicalLoad.episodes;
  const canScheduleNext =
    staff.rol === "admin" || staff.rol === "terapeuta";
  const canEditContact = staff.rol === "admin" || staff.rol === "recepcionista";
  const canAddToAttend = RoleCapabilities[staff.rol].asignarCitasYCola;

  return (
    <main>
      <ActionButton
        href="/app/pacientes"
        variant="ghost"
        inline
        className="!px-2 !py-1 text-sm"
      >
        ← Pacientes
      </ActionButton>
      <h1 className="mt-3 font-serif text-3xl">{p.nombre}</h1>
      <p className="text-muted mt-1 text-sm">
        Alta: {formatInClinicTz(p.created_at, tz)}
        {canClinical ? " · Vista clínica" : ""}
      </p>

      <section className="mt-8">
        <div className="border-brand/15 bg-surface rounded-xl border p-5">
          <h2 className="font-semibold">Contacto</h2>
          <p className="text-muted mt-1 text-xs">
            Información registrada por recepción.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Teléfono" value={p.telefono} />
            <Row label="Correo" value={p.email ?? "—"} />
            <Row label="Nacimiento" value={p.fecha_nacimiento ?? "—"} />
            <Row label="Ocupación" value={p.ocupacion ?? "—"} />
            <Row
              label="Emergencia"
              value={
                p.contacto_emergencia_nombre
                  ? `${p.contacto_emergencia_nombre} (${p.contacto_emergencia_telefono ?? "s/n"})`
                  : "—"
              }
            />
            <Row
              label="Opt-in"
              value={
                [
                  p.opt_in_email ? "email" : null,
                  p.opt_in_sms ? "sms" : null,
                  p.opt_in_whatsapp ? "whatsapp" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "ninguno"
              }
            />
            <Row
              label="Referido por"
              value={
                referido
                  ? `${referido.apellido}, ${referido.nombre}${
                      referido.especialidad ? ` (${referido.especialidad})` : ""
                    }`
                  : "—"
              }
            />
          </dl>
          {canEditContact ? (
            <ContactEditForm
              patient={{
                id: p.id,
                nombre: p.nombre,
                telefono: p.telefono,
                email: p.email,
                fechaNacimiento: p.fecha_nacimiento,
                contactoEmergenciaNombre: p.contacto_emergencia_nombre,
                contactoEmergenciaTelefono: p.contacto_emergencia_telefono,
                ocupacion: p.ocupacion,
                referidoDoctorId: p.referido_doctor_id,
                optInEmail: p.opt_in_email,
                optInSms: p.opt_in_sms,
                optInWhatsapp: p.opt_in_whatsapp,
              }}
              referringDoctors={referringDoctorOpts}
            />
          ) : null}
        </div>
      </section>

      {canClinical ? (
        <section className="mt-8">
          <ClinicalEpisodesWorkspace
            patientId={p.id}
            initialEpisodes={clinicalEpisodes}
            initialClinicalId={clinicalIdParam ?? null}
            appointments={appointmentOpts}
            timezone={tz}
            services={services}
            activeConsultation={activeConsultation}
            canFinalizeConsultation={canFinalizeConsultation}
            canWriteClinical={canWriteClinical}
            canManageEpisodes={canManageEpisodes}
            canWriteSessionNotes={canWriteSessionNotes}
            multiExpedienteEnabled={clinicalLoad.multiExpediente}
            loadError={clinicalLoad.error}
          />
        </section>
      ) : (
        <p className="text-muted mt-8 text-sm">
          Su rol ({staff.rol}) no tiene acceso al contenido clínico.
        </p>
      )}

      {canScheduleNext ? (
        <section className="mt-8">
          <NextAppointmentPanel
            patientId={p.id}
            patientNombre={p.nombre}
            therapists={(
              (therapists ?? []) as Array<{ id: string; nombre: string }>
            ).map((t) => ({ id: t.id, label: t.nombre }))}
            defaultTerapeutaId={
              staff.rol === "terapeuta"
                ? staff.id
                : ((therapists ?? []) as Array<{ id: string }>)[0]?.id ?? staff.id
            }
            lockTherapist={staff.rol === "terapeuta"}
            timezone={tz}
          />
        </section>
      ) : null}

      {canAddToAttend ? (
        <section className="mt-8">
          <AddToAttendPanel
            fixedPatient={{ id: p.id, nombre: p.nombre }}
            therapists={(
              (therapists ?? []) as Array<{ id: string; nombre: string }>
            ).map((t) => ({ id: t.id, label: t.nombre }))}
            timezone={tz}
          />
        </section>
      ) : null}

      <section className="border-brand/15 bg-surface mt-8 rounded-xl border p-5">
        <h2 className="font-semibold">Historial de citas</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {apptRows.length === 0 ? (
            <li className="text-muted">Sin citas registradas.</li>
          ) : (
            apptRows.map((a) => (
              <li
                key={a.id}
                className="border-brand/5 flex justify-between gap-4 border-b py-2"
              >
                <span>
                  {formatInClinicTz(a.inicio, tz)} — {a.tipo_servicio ?? "Consulta"}
                </span>
                <span className="text-muted">{a.estado}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
