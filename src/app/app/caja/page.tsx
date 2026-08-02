import { redirect } from "next/navigation";

import { CajaDashboard } from "@/components/caja/CajaDashboard";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import {
  clinicYearStartUtc,
  type CajaPaymentRow,
  type CajaServiceLine,
} from "@/lib/payments/caja-periods";
import { requireMenuAccess } from "@/lib/permissions/require";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Caja — Terafis" };

export default async function CajaPage() {
  const staff = await getCurrentStaff();

  if (!staff || !RoleCapabilities[staff.rol].verPagos) {
    redirect("/app");
  }

  if (staff.rol !== "admin" && staff.rol !== "recepcionista") {
    redirect("/app");
  }

  await requireMenuAccess(staff, "caja");

  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("clinic_config")
    .select("timezone")
    .eq("clinic_id", staff.clinicId)
    .maybeSingle();

  const timezone = (cfg as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
  // Solo año en curso (evita arrastrar meses del año pasado en la UI).
  const fromUtc = clinicYearStartUtc(timezone);

  const [{ data: payRows }, { data: pats }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, appointment_id, monto, metodo_pago, estado, fecha_pago, referencia, cambio, paciente_id",
      )
      .eq("estado", "pagado")
      .gte("fecha_pago", fromUtc)
      .order("fecha_pago", { ascending: false })
      .limit(3000),
    supabase.from("patients").select("id, nombre").is("deleted_at", null),
  ]);

  const names = new Map(
    ((pats ?? []) as Array<{ id: string; nombre: string }>).map((p) => [p.id, p.nombre]),
  );

  const rawPayments = (
    (payRows ?? []) as Array<{
      id: string;
      appointment_id: string;
      monto: string | number;
      metodo_pago: string;
      fecha_pago: string | null;
      referencia: string | null;
      cambio: string | number | null;
      paciente_id: string;
    }>
  ).filter((p) => Boolean(p.fecha_pago));

  const appointmentIds = [
    ...new Set(rawPayments.map((p) => p.appointment_id).filter(Boolean)),
  ];

  const servicesByAppt = new Map<string, CajaServiceLine[]>();
  if (appointmentIds.length > 0) {
    const { data: lines } = await supabase
      .from("appointment_services")
      .select("appointment_id, costo_aplicado, cantidad, services(titulo)")
      .in("appointment_id", appointmentIds);

    for (const line of (lines ?? []) as Array<{
      appointment_id: string;
      costo_aplicado: string | number;
      cantidad: number;
      services: { titulo: string } | { titulo: string }[] | null;
    }>) {
      const svc = Array.isArray(line.services) ? line.services[0] : line.services;
      const costo = Number(line.costo_aplicado);
      const cantidad = Number(line.cantidad) || 1;
      const entry: CajaServiceLine = {
        titulo: svc?.titulo ?? "Servicio",
        cantidad,
        costoUnitario: costo,
        subtotal: costo * cantidad,
      };
      const list = servicesByAppt.get(line.appointment_id) ?? [];
      list.push(entry);
      servicesByAppt.set(line.appointment_id, list);
    }
  }

  const payments: CajaPaymentRow[] = rawPayments.map((p) => ({
    id: p.id,
    appointmentId: p.appointment_id,
    monto: Number(p.monto),
    metodoPago: p.metodo_pago,
    fechaPago: p.fecha_pago!,
    referencia: p.referencia,
    cambio: p.cambio == null ? null : Number(p.cambio),
    pacienteId: p.paciente_id,
    pacienteNombre: names.get(p.paciente_id) ?? "Paciente",
    servicios: servicesByAppt.get(p.appointment_id) ?? [],
  }));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Caja</h1>
        <p className="text-muted mt-1 text-sm">
          Detalle del mes en curso, con filtros por mes y fechas de atención.
        </p>
      </div>

      <CajaDashboard payments={payments} timezone={timezone} />
    </main>
  );
}
