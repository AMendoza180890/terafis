"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  InventoryMovementSchema,
  ProductSchema,
  SellProductSchema,
} from "@/lib/inventory/schemas";
import { hasMenuAccess } from "@/lib/permissions/require";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true; id?: string; existencia?: number; bajoMinimo?: boolean }
  | { ok: false; error: string };

export async function createProductAction(raw: unknown): Promise<ActionResult> {
  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin permiso para crear productos" };
  }

  const supabase = await createClient();
  const input = parsed.data;

  const { data: service, error: svcErr } = await supabase
    .from("services")
    .insert({
      clinic_id: staff.clinicId,
      tipo: "producto",
      titulo: input.nombre,
      descripcion: input.descripcion ?? null,
      costo: input.precioVenta,
      activo: input.activo,
    })
    .select("id")
    .single();

  if (svcErr) return { ok: false, error: svcErr.message };

  const { data, error } = await supabase
    .from("products")
    .insert({
      clinic_id: staff.clinicId,
      service_id: (service as { id: string }).id,
      sku: input.sku || null,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      unidad: input.unidad,
      precio_venta: input.precioVenta,
      stock_minimo: input.stockMinimo,
      activo: input.activo,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "product.create",
    tabla: "products",
    registroId: (data as { id: string }).id,
    diff: { nombre: input.nombre, precioVenta: input.precioVenta },
  });

  revalidatePath("/app/inventario");
  revalidatePath("/app/servicios");
  return { ok: true, id: (data as { id: string }).id };
}

export async function recordMovementAction(raw: unknown): Promise<ActionResult> {
  const parsed = InventoryMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (!(await hasMenuAccess(staff, "inventario"))) {
    return { ok: false, error: "Sin permiso para registrar movimientos" };
  }

  const supabase = await createClient();
  const m = parsed.data;

  const cantidad = m.tipo === "ajuste" ? Math.abs(m.signedDelta) : m.cantidad;
  const signed = m.tipo === "ajuste" ? m.signedDelta : null;

  const { data, error } = await supabase.rpc("record_inventory_movement", {
    p_product_id: m.productId,
    p_tipo: m.tipo,
    p_cantidad: cantidad,
    p_motivo: m.motivo ?? null,
    p_appointment_id: m.tipo === "consumo_sesion" ? (m.appointmentId ?? null) : null,
    p_signed_delta: signed,
  });

  if (error) {
    if (error.message.includes("STOCK_INSUFICIENTE")) {
      return { ok: false, error: "Stock insuficiente" };
    }
    return { ok: false, error: error.message };
  }

  const result = data as {
    movement_id: string;
    existencia: number;
    bajo_minimo: boolean;
  };

  await writeAuditLog({
    staff,
    accion: "inventory.movement",
    tabla: "inventory_movements",
    registroId: result.movement_id,
    diff: { tipo: m.tipo, productId: m.productId },
  });

  revalidatePath("/app/inventario");
  return {
    ok: true,
    id: result.movement_id,
    existencia: result.existencia,
    bajoMinimo: result.bajo_minimo,
  };
}

export async function sellProductAction(raw: unknown): Promise<ActionResult> {
  const parsed = SellProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin permiso para vender productos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_product", {
    p_product_id: parsed.data.productId,
    p_appointment_id: parsed.data.appointmentId,
    p_cantidad: parsed.data.cantidad,
  });

  if (error) {
    if (error.message.includes("STOCK_INSUFICIENTE")) {
      return { ok: false, error: "Stock insuficiente" };
    }
    return { ok: false, error: error.message };
  }

  const result = data as { appointment_service_id: string; existencia: number };

  await writeAuditLog({
    staff,
    accion: "inventory.sell",
    tabla: "appointment_services",
    registroId: result.appointment_service_id,
    diff: {
      productId: parsed.data.productId,
      appointmentId: parsed.data.appointmentId,
      cantidad: parsed.data.cantidad,
    },
  });

  revalidatePath("/app/inventario");
  revalidatePath("/app/caja");
  return { ok: true, id: result.appointment_service_id, existencia: result.existencia };
}
