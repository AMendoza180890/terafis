import { AddToAttendPanel } from "@/components/queue/AddToAttendPanel";
import { QueueBoard } from "@/components/queue/QueueBoard";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { clinicTodayIso, DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { fromCents } from "@/lib/money/cents";
import { sumLineItemsCents } from "@/lib/money/totals";
import type { QueueStatus } from "@/lib/queue/schemas";
import type { QueueItemView } from "@/lib/queue/types";
import { requireMenuAccess } from "@/lib/permissions/require";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cola de atención — Terafis" };

type Props = { searchParams: Promise<{ patientId?: string }> };

export default async function ColaPage({ searchParams }: Props) {
  const staff = await getCurrentStaff();
  await requireMenuAccess(staff, "cola");
  const { patientId: preselectId } = await searchParams;
  let items: QueueItemView[] = [];
  let services: Array<{ id: string; titulo: string; costo: string }> = [];
  let therapists: Array<{ id: string; label: string }> = [];
  let timezone = DEFAULT_TZ;
  let fecha = clinicTodayIso(DEFAULT_TZ);
  let fixedPatient: { id: string; nombre: string } | null = null;

  const canManage = !!staff && RoleCapabilities[staff.rol].asignarCitasYCola;

  if (staff) {
    const supabase = await createClient();

    const { data: config } = await supabase
      .from("clinic_config")
      .select("timezone")
      .eq("clinic_id", staff.clinicId)
      .maybeSingle();

    timezone = (config as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
    fecha = clinicTodayIso(timezone);

    const [
      { data: queueRows },
      { data: svcRows },
      { data: pats },
      { data: ther },
      { data: therOpts },
    ] = await Promise.all([
      supabase
        .from("daily_queue")
        .select(
          "id, appointment_id, patient_id, terapeuta_id, sala_id, fecha, hora_cita, hora_inicio_atencion, hora_fin_atencion, estado, prioridad, posicion_cola, version, notas_recepcion",
        )
        .eq("fecha", fecha)
        .order("posicion_cola", { ascending: true }),
      supabase
        .from("services")
        .select("id, titulo, costo")
        .eq("activo", true)
        .order("titulo"),
      supabase.from("patients").select("id, nombre, telefono").is("deleted_at", null),
      supabase.from("staff").select("id, nombre"),
      supabase
        .from("staff")
        .select("id, nombre")
        .eq("rol", "terapeuta")
        .eq("activo", true)
        .is("deleted_at", null)
        .order("nombre"),
    ]);

    const patientMap = new Map(
      ((pats ?? []) as Array<{ id: string; nombre: string; telefono: string }>).map(
        (p) => [p.id, { nombre: p.nombre, telefono: p.telefono }],
      ),
    );
    const therapistMap = new Map(
      ((ther ?? []) as Array<{ id: string; nombre: string }>).map((t) => [
        t.id,
        t.nombre,
      ]),
    );
    therapists = ((therOpts ?? []) as Array<{ id: string; nombre: string }>).map((t) => ({
      id: t.id,
      label: t.nombre,
    }));

    if (preselectId && patientMap.has(preselectId)) {
      fixedPatient = {
        id: preselectId,
        nombre: patientMap.get(preselectId)?.nombre ?? "Paciente",
      };
    }

    services = (
      (svcRows ?? []) as Array<{ id: string; titulo: string; costo: string | number }>
    ).map((s) => ({
      id: s.id,
      titulo: s.titulo,
      costo: String(s.costo),
    }));

    const rows = (queueRows ?? []) as Array<{
      id: string;
      appointment_id: string;
      patient_id: string;
      terapeuta_id: string;
      sala_id: string | null;
      fecha: string;
      hora_cita: string;
      hora_inicio_atencion: string | null;
      hora_fin_atencion: string | null;
      estado: QueueStatus;
      prioridad: number;
      posicion_cola: number;
      version: number;
      notas_recepcion: string | null;
    }>;

    const detailApptIds = rows
      .filter((r) => ["en_consulta", "pendiente_pago", "completado"].includes(r.estado))
      .map((r) => r.appointment_id);

    const allApptIds = [...new Set(rows.map((r) => r.appointment_id))];
    const tipoByAppt = new Map<string, string | null>();
    if (allApptIds.length > 0) {
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, tipo_servicio")
        .in("id", allApptIds);
      for (const a of (appts ?? []) as Array<{
        id: string;
        tipo_servicio: string | null;
      }>) {
        tipoByAppt.set(a.id, a.tipo_servicio);
      }
    }

    const totals = new Map<string, string>();
    const servicesByAppt = new Map<string, string[]>();
    if (detailApptIds.length > 0) {
      const { data: lines } = await supabase
        .from("appointment_services")
        .select("appointment_id, costo_aplicado, cantidad, services(titulo)")
        .in("appointment_id", detailApptIds);

      const grouped = new Map<
        string,
        Array<{ costoAplicado: string | number; cantidad: number }>
      >();
      for (const line of (lines ?? []) as Array<{
        appointment_id: string;
        costo_aplicado: string | number;
        cantidad: number;
        services: { titulo: string } | { titulo: string }[] | null;
      }>) {
        if (staff.rol !== "terapeuta") {
          const arr = grouped.get(line.appointment_id) ?? [];
          arr.push({
            costoAplicado: line.costo_aplicado,
            cantidad: line.cantidad,
          });
          grouped.set(line.appointment_id, arr);
        }
        const svc = Array.isArray(line.services) ? line.services[0] : line.services;
        if (svc?.titulo) {
          const list = servicesByAppt.get(line.appointment_id) ?? [];
          list.push(svc.titulo);
          servicesByAppt.set(line.appointment_id, list);
        }
      }
      for (const [apptId, group] of grouped) {
        totals.set(apptId, fromCents(sumLineItemsCents(group)));
      }
    }

    items = rows.map((r) => {
      const patient = patientMap.get(r.patient_id);
      return {
        id: r.id,
        appointmentId: r.appointment_id,
        patientId: r.patient_id,
        patientNombre: patient?.nombre ?? "Paciente",
        patientTelefono: patient?.telefono ?? null,
        terapeutaId: r.terapeuta_id,
        terapeutaNombre: therapistMap.get(r.terapeuta_id) ?? "Terapeuta",
        salaNombre: null,
        fecha: r.fecha,
        horaCita: r.hora_cita,
        horaInicioAtencion: r.hora_inicio_atencion,
        horaFinAtencion: r.hora_fin_atencion,
        tipoServicio: tipoByAppt.get(r.appointment_id) ?? null,
        estado: r.estado,
        prioridad: r.prioridad,
        posicionCola: r.posicion_cola,
        version: r.version,
        notasRecepcion: r.notas_recepcion,
        totalPendiente:
          r.estado === "pendiente_pago" ? (totals.get(r.appointment_id) ?? null) : null,
        serviciosResumen: servicesByAppt.get(r.appointment_id) ?? [],
      };
    });
  }

  return (
    <main className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl">Cola de atención</h1>
        <p className="text-muted mt-1 text-sm">
          {canManage
            ? `Día ${fecha} (${timezone}). Del check-in al cobro.`
            : staff?.rol === "terapeuta"
              ? `Día ${fecha}. En sus turnos: Iniciar consulta → Finalizar.`
              : `Día ${fecha}. Lista en solo lectura.`}
        </p>
      </div>

      {canManage ? (
        <AddToAttendPanel
          therapists={therapists}
          timezone={timezone}
          fixedPatient={fixedPatient}
        />
      ) : null}

      <QueueBoard
        clinicId={staff?.clinicId ?? null}
        fecha={fecha}
        items={items}
        services={services}
        canManage={canManage}
        canCharge={canManage}
        canAttend={staff?.rol === "terapeuta"}
        canFinalize={staff?.rol === "admin" || staff?.rol === "terapeuta"}
        canSync={canManage}
        currentStaffId={staff?.id ?? null}
      />
    </main>
  );
}
