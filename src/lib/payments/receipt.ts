"use server";

import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { fromCents, toCents, type Cents } from "@/lib/money/cents";
import { createClient } from "@/lib/supabase/server";

export type PaymentReceiptLine = {
  titulo: string;
  cantidad: number;
  costoUnitario: string;
  subtotal: string;
};

export type PaymentReceipt = {
  paymentId: string;
  appointmentId: string;
  clinicNombre: string;
  clinicDireccion: string | null;
  clinicTelefono: string | null;
  timezone: string;
  pacienteNombre: string;
  fechaPago: string;
  metodoPago: string;
  monto: string;
  montoRecibido: string | null;
  cambio: string | null;
  referencia: string | null;
  cajeroNombre: string | null;
  lines: PaymentReceiptLine[];
};

export async function getPaymentReceiptAction(
  paymentId: string,
): Promise<{ ok: true; receipt: PaymentReceipt } | { ok: false; error: string }> {
  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin acceso a facturas de cobro" };
  }

  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, appointment_id, paciente_id, monto, monto_recibido, cambio, metodo_pago, referencia, fecha_pago, cajero_id, estado, clinic_id",
    )
    .eq("id", paymentId)
    .eq("clinic_id", staff.clinicId)
    .maybeSingle();

  if (error || !payment) {
    return { ok: false, error: error?.message ?? "Pago no encontrado" };
  }

  const p = payment as {
    id: string;
    appointment_id: string;
    paciente_id: string;
    monto: string | number;
    monto_recibido: string | number | null;
    cambio: string | number | null;
    metodo_pago: string;
    referencia: string | null;
    fecha_pago: string;
    cajero_id: string | null;
    estado: string;
    clinic_id: string;
  };

  const [patientRes, clinicRes, configRes, linesRes, cajeroRes] = await Promise.all([
    supabase.from("patients").select("nombre").eq("id", p.paciente_id).maybeSingle(),
    supabase.from("clinics").select("nombre").eq("id", p.clinic_id).maybeSingle(),
    supabase
      .from("clinic_config")
      .select("direccion, telefono, timezone")
      .eq("clinic_id", p.clinic_id)
      .maybeSingle(),
    supabase
      .from("appointment_services")
      .select("service_id, costo_aplicado, cantidad")
      .eq("appointment_id", p.appointment_id),
    p.cajero_id
      ? supabase.from("staff").select("nombre").eq("id", p.cajero_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const serviceIds = [
    ...new Set(
      ((linesRes.data ?? []) as Array<{ service_id: string }>).map((l) => l.service_id),
    ),
  ];
  const titles = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: svcs } = await supabase
      .from("services")
      .select("id, titulo")
      .in("id", serviceIds);
    for (const s of (svcs ?? []) as Array<{ id: string; titulo: string }>) {
      titles.set(s.id, s.titulo);
    }
  }

  const lines: PaymentReceiptLine[] = (
    (linesRes.data ?? []) as Array<{
      service_id: string;
      costo_aplicado: string | number;
      cantidad: number;
    }>
  ).map((l) => ({
    titulo: titles.get(l.service_id) ?? "Servicio",
    cantidad: l.cantidad,
    costoUnitario: String(l.costo_aplicado),
    subtotal: fromCents((toCents(l.costo_aplicado) * l.cantidad) as Cents),
  }));

  const config = configRes.data as {
    direccion: string | null;
    telefono: string | null;
    timezone: string | null;
  } | null;

  return {
    ok: true,
    receipt: {
      paymentId: p.id,
      appointmentId: p.appointment_id,
      clinicNombre: (clinicRes.data as { nombre?: string } | null)?.nombre ?? "Terafis",
      clinicDireccion: config?.direccion ?? null,
      clinicTelefono: config?.telefono ?? null,
      timezone: config?.timezone || DEFAULT_TZ,
      pacienteNombre:
        (patientRes.data as { nombre?: string } | null)?.nombre ?? "Paciente",
      fechaPago: p.fecha_pago,
      metodoPago: p.metodo_pago,
      monto: String(p.monto),
      montoRecibido: p.monto_recibido == null ? null : String(p.monto_recibido),
      cambio: p.cambio == null ? null : String(p.cambio),
      referencia: p.referencia,
      cajeroNombre: (cajeroRes.data as { nombre?: string } | null)?.nombre ?? null,
      lines,
    },
  };
}
