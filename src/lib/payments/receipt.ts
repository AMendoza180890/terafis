"use server";

import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { decryptField } from "@/lib/crypto/aes-gcm";
import { decryptOptionalText } from "@/lib/crypto/clinical-fields";
import { DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { fromCents, toCents, type Cents } from "@/lib/money/cents";
import { createClient } from "@/lib/supabase/server";
import { exercisesToDetalle } from "@/lib/treatment-plans/schemas";

export type PaymentReceiptLine = {
  titulo: string;
  cantidad: number;
  costoUnitario: string;
  subtotal: string;
};

export type PaymentReceiptSessionNote = {
  notasEvolucion: string | null;
  tratamiento: string | null;
  observaciones: string | null;
  rangoMovimiento: string | null;
  dolorEva: number | null;
  createdAt: string;
};

export type PaymentReceiptPlan = {
  diagnostico: string;
  objetivo: string;
  frecuencia: string;
  duracionEstimadaSemanas: number | null;
  ejerciciosDetalle: string;
  version: number;
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
  sessionNote: PaymentReceiptSessionNote | null;
  treatmentPlan: PaymentReceiptPlan | null;
};

function decryptCipher(cipher: string | null, key: string | undefined): string {
  if (!cipher) return "";
  if (!key) return "";
  try {
    return decryptField(cipher, key);
  } catch {
    return "";
  }
}

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

  const [
    patientRes,
    clinicRes,
    configRes,
    linesRes,
    noteRes,
    planRes,
    cajeroRes,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("nombre")
      .eq("id", p.paciente_id)
      .maybeSingle(),
    supabase
      .from("clinics")
      .select("nombre")
      .eq("id", p.clinic_id)
      .maybeSingle(),
    supabase
      .from("clinic_config")
      .select("direccion, telefono, timezone")
      .eq("clinic_id", p.clinic_id)
      .maybeSingle(),
    supabase
      .from("appointment_services")
      .select("service_id, costo_aplicado, cantidad")
      .eq("appointment_id", p.appointment_id),
    supabase
      .from("session_notes")
      .select(
        "notas_evolucion, tratamiento, observaciones, rango_movimiento, dolor_eva, created_at",
      )
      .eq("appointment_id", p.appointment_id)
      .eq("patient_id", p.paciente_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("treatment_plans")
      .select("id, version_actual")
      .eq("patient_id", p.paciente_id)
      .eq("clinic_id", p.clinic_id)
      .eq("activo", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    p.cajero_id
      ? supabase.from("staff").select("nombre").eq("id", p.cajero_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const serviceIds = [
    ...new Set(
      ((linesRes.data ?? []) as Array<{ service_id: string }>).map(
        (l) => l.service_id,
      ),
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

  let sessionNote: PaymentReceiptSessionNote | null = null;
  if (noteRes.data) {
    const n = noteRes.data as {
      notas_evolucion: string | null;
      tratamiento: string | null;
      observaciones: string | null;
      rango_movimiento: string | null;
      dolor_eva: number | null;
      created_at: string;
    };
    sessionNote = {
      notasEvolucion: decryptOptionalText(n.notas_evolucion),
      tratamiento: decryptOptionalText(n.tratamiento),
      observaciones: decryptOptionalText(n.observaciones),
      rangoMovimiento: decryptOptionalText(n.rango_movimiento),
      dolorEva: n.dolor_eva,
      createdAt: n.created_at,
    };
  }

  let treatmentPlan: PaymentReceiptPlan | null = null;
  const planRow = planRes.data as
    | { id: string; version_actual: number }
    | null;
  if (planRow) {
    const { data: version } = await supabase
      .from("treatment_plan_versions")
      .select(
        "id, version, diagnostico, objetivo, frecuencia, duracion_estimada_semanas",
      )
      .eq("plan_id", planRow.id)
      .eq("version", planRow.version_actual)
      .maybeSingle();

    if (version) {
      const v = version as {
        id: string;
        version: number;
        diagnostico: string | null;
        objetivo: string | null;
        frecuencia: string;
        duracion_estimada_semanas: number | null;
      };
      const { data: exercises } = await supabase
        .from("treatment_exercises")
        .select("nombre, descripcion, series, repeticiones, orden")
        .eq("plan_version_id", v.id)
        .order("orden", { ascending: true });

      const key = process.env.FIELD_ENCRYPTION_KEY;
      const exerciseRows = (
        (exercises ?? []) as Array<{
          nombre: string;
          descripcion: string | null;
          series: number | null;
          repeticiones: number | null;
        }>
      ).map((e) => ({
        nombre: e.nombre,
        descripcion: decryptCipher(e.descripcion, key),
        series: e.series,
        repeticiones: e.repeticiones,
      }));

      treatmentPlan = {
        diagnostico: decryptCipher(v.diagnostico, key),
        objetivo: decryptCipher(v.objetivo, key),
        frecuencia: v.frecuencia,
        duracionEstimadaSemanas: v.duracion_estimada_semanas,
        ejerciciosDetalle: exercisesToDetalle(exerciseRows),
        version: v.version,
      };
    }
  }

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
      clinicNombre:
        (clinicRes.data as { nombre?: string } | null)?.nombre ?? "Terafis",
      clinicDireccion: config?.direccion ?? null,
      clinicTelefono: config?.telefono ?? null,
      timezone: config?.timezone || DEFAULT_TZ,
      pacienteNombre:
        (patientRes.data as { nombre?: string } | null)?.nombre ?? "Paciente",
      fechaPago: p.fecha_pago,
      metodoPago: p.metodo_pago,
      monto: String(p.monto),
      montoRecibido:
        p.monto_recibido == null ? null : String(p.monto_recibido),
      cambio: p.cambio == null ? null : String(p.cambio),
      referencia: p.referencia,
      cajeroNombre:
        (cajeroRes.data as { nombre?: string } | null)?.nombre ?? null,
      lines,
      sessionNote,
      treatmentPlan,
    },
  };
}
