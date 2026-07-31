import { InventoryClient } from "@/components/inventory/InventoryClient";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Inventario — Terafis" };

export default async function InventarioPage() {
  const staff = await getCurrentStaff();
  const canManage = staff?.rol === "admin" || staff?.rol === "recepcionista";

  let products: Array<{
    id: string;
    nombre: string;
    sku: string | null;
    unidad: string;
    precio_venta: string;
    stock_minimo: number;
    activo: boolean;
    existencia: number;
    bajo_minimo: boolean;
  }> = [];
  let appointments: Array<{ id: string; label: string }> = [];

  if (staff) {
    const supabase = await createClient();
    const [{ data: prods }, { data: stock }, { data: appts }, { data: pats }] =
      await Promise.all([
        supabase
          .from("products")
          .select("id, nombre, sku, unidad, precio_venta, stock_minimo, activo")
          .eq("activo", true)
          .order("nombre"),
        supabase.from("product_stock").select("product_id, existencia, bajo_minimo"),
        supabase
          .from("appointments")
          .select("id, inicio, patient_id, estado")
          .not("estado", "in", "(cancelado,completado,no_asistio)")
          .order("inicio", { ascending: false })
          .limit(40),
        supabase.from("patients").select("id, nombre").is("deleted_at", null),
      ]);

    const stockMap = new Map(
      (
        (stock ?? []) as Array<{
          product_id: string;
          existencia: number;
          bajo_minimo: boolean;
        }>
      ).map((s) => [s.product_id, s]),
    );
    const names = new Map(
      ((pats ?? []) as Array<{ id: string; nombre: string }>).map((p) => [
        p.id,
        p.nombre,
      ]),
    );

    products = (
      (prods ?? []) as Array<{
        id: string;
        nombre: string;
        sku: string | null;
        unidad: string;
        precio_venta: string | number;
        stock_minimo: number;
        activo: boolean;
      }>
    ).map((p) => {
      const s = stockMap.get(p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        unidad: p.unidad,
        precio_venta: String(p.precio_venta),
        stock_minimo: p.stock_minimo,
        activo: p.activo,
        existencia: s?.existencia ?? 0,
        bajo_minimo:
          s?.bajo_minimo ?? (s?.existencia ?? 0) <= p.stock_minimo,
      };
    });

    appointments = (
      (appts ?? []) as Array<{
        id: string;
        inicio: string;
        patient_id: string;
        estado: string;
      }>
    ).map((a) => ({
      id: a.id,
      label: `${new Date(a.inicio).toLocaleString("es")} — ${names.get(a.patient_id) ?? "Paciente"} (${a.estado})`,
    }));
  }

  return (
    <main>
      <h1 className="font-serif text-3xl">Inventario</h1>
      <p className="text-muted mt-2 text-sm">
        Órtesis, vendajes, consumibles. Movimientos append-only; alertas al
        llegar al mínimo.
      </p>
      <div className="mt-8">
        <InventoryClient
          products={products}
          appointments={appointments}
          canManage={!!canManage}
        />
      </div>
    </main>
  );
}
