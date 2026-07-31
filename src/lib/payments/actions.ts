"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { cashChange, fromCents, toCents, type Cents } from "@/lib/money/cents";
import { formatMoney, sumLineItemsCents } from "@/lib/money/totals";
import { RegisterPaymentSchema } from "@/lib/payments/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | {
      ok: true;
      id: string;
      monto: string;
      cambio: string | null;
      idempotentReplay: boolean;
    }
  | { ok: false; error: string; conflict?: boolean };

export async function getAppointmentTotalAction(appointmentId: string) {
  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false as const, error: "Sin acceso a totales de cobro" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_services")
    .select("costo_aplicado, cantidad, service_id")
    .eq("appointment_id", appointmentId);

  if (error) return { ok: false as const, error: error.message };

  const lines = (data ?? []) as Array<{
    costo_aplicado: string | number;
    cantidad: number;
    service_id: string;
  }>;

  const serviceIds = [...new Set(lines.map((l) => l.service_id))];
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

  const totalCents = sumLineItemsCents(
    lines.map((l) => ({ costoAplicado: l.costo_aplicado, cantidad: l.cantidad })),
  );

  return {
    ok: true as const,
    total: fromCents(totalCents),
    totalLabel: formatMoney(totalCents),
    lines: lines.map((l) => ({
      serviceId: l.service_id,
      titulo: titles.get(l.service_id) ?? "Servicio",
      costoAplicado: String(l.costo_aplicado),
      cantidad: l.cantidad,
      subtotal: fromCents((toCents(l.costo_aplicado) * l.cantidad) as Cents),
    })),
  };
}

export async function registerPaymentAction(raw: unknown): Promise<ActionResult> {
  const parsed = RegisterPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "El terapeuta no puede registrar pagos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_payment", {
    p_appointment_id: parsed.data.appointmentId,
    p_queue_id: parsed.data.queueId,
    p_expected_version: parsed.data.expectedVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_metodo: parsed.data.metodoPago,
    p_monto_recibido: parsed.data.montoRecibido
      ? Number(parsed.data.montoRecibido)
      : null,
    p_referencia: parsed.data.referencia ?? null,
    p_comprobante_path: parsed.data.comprobantePath ?? null,
  });

  if (error) {
    if (error.message.includes("VERSION_CONFLICT")) {
      return {
        ok: false,
        conflict: true,
        error: "Otro usuario ya actualizó este registro. Recargue la cola.",
      };
    }
    return { ok: false, error: error.message };
  }

  const result = data as {
    payment_id: string;
    monto: number | string;
    cambio: number | string | null;
    idempotent_replay: boolean;
  };

  await writeAuditLog({
    staff,
    accion: result.idempotent_replay ? "payment.idempotent_replay" : "payment.register",
    tabla: "payments",
    registroId: result.payment_id,
    diff: {
      metodo: parsed.data.metodoPago,
      monto: result.monto,
      replay: result.idempotent_replay,
    },
  });

  revalidatePath("/app/cola");
  revalidatePath("/app/caja");

  return {
    ok: true,
    id: result.payment_id,
    monto: String(result.monto),
    cambio: result.cambio == null ? null : String(result.cambio),
    idempotentReplay: result.idempotent_replay,
  };
}

/** Vista previa de cambio (solo UI; el servidor recalcula al cobrar). */
export async function previewCashChangeAction(total: string, recibido: string) {
  try {
    const change = cashChange(toCents(recibido), toCents(total));
    return {
      ok: true as const,
      cambio: fromCents(change),
      insuficiente: change < 0,
    };
  } catch {
    return { ok: false as const, error: "Montos inválidos" };
  }
}
