"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createProductAction,
  recordMovementAction,
  sellProductAction,
} from "@/lib/inventory/actions";
import { formatCordobas } from "@/lib/money/format";

export type ProductRow = {
  id: string;
  nombre: string;
  sku: string | null;
  unidad: string;
  precio_venta: string;
  stock_minimo: number;
  activo: boolean;
  existencia: number;
  bajo_minimo: boolean;
};

export function InventoryClient({
  products,
  appointments,
  canManage,
}: {
  products: ProductRow[];
  appointments: Array<{ id: string; label: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {msg ? (
        <p className="text-accent text-sm" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <section>
        <h2 className="font-serif text-xl">Existencias</h2>
        <p className="text-muted mt-1 text-sm">
          Stock derivado de movimientos append-only (sin contador editable).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted border-b">
                <th className="py-2 pr-3 font-medium">Producto</th>
                <th className="py-2 pr-3 font-medium">SKU</th>
                <th className="py-2 pr-3 font-medium">Existencia</th>
                <th className="py-2 pr-3 font-medium">Mínimo</th>
                <th className="py-2 font-medium">Precio</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-black/5">
                  <td className="py-2 pr-3">
                    {p.nombre}
                    {p.bajo_minimo ? (
                      <span className="ml-2 text-xs font-medium text-amber-700">
                        Reorden
                      </span>
                    ) : null}
                  </td>
                  <td className="text-muted py-2 pr-3">{p.sku ?? "—"}</td>
                  <td className="py-2 pr-3 font-semibold">
                    {p.existencia} {p.unidad}
                  </td>
                  <td className="py-2 pr-3">{p.stock_minimo}</td>
                  <td className="py-2">{formatCordobas(p.precio_venta)}</td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted py-6">
                    Sin productos. Cree el primero abajo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <>
          <section className="border-brand/15 bg-surface rounded-xl border p-5">
            <h2 className="font-serif text-lg">Nuevo producto</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                setErr(null);
                setMsg(null);
                start(async () => {
                  const res = await createProductAction({
                    nombre: String(fd.get("nombre") ?? ""),
                    sku: String(fd.get("sku") ?? "") || null,
                    unidad: String(fd.get("unidad") ?? "unidad"),
                    precioVenta: String(fd.get("precioVenta") ?? "0"),
                    stockMinimo: Number(fd.get("stockMinimo") ?? 0),
                    activo: true,
                  });
                  if (!res.ok) setErr(res.error);
                  else {
                    setMsg("Producto creado");
                    form.reset();
                    router.refresh();
                  }
                });
              }}
            >
              <label className="block text-sm">
                Nombre
                <input
                  name="nombre"
                  required
                  className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                SKU
                <input
                  name="sku"
                  className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Precio venta (C$)
                <input
                  name="precioVenta"
                  required
                  placeholder="0.00"
                  className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Stock mínimo
                <input
                  name="stockMinimo"
                  type="number"
                  min={0}
                  defaultValue={5}
                  className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Unidad
                <input
                  name="unidad"
                  defaultValue="unidad"
                  className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  Guardar producto
                </button>
              </div>
            </form>
          </section>

          <section className="border-brand/15 bg-surface grid gap-6 rounded-xl border p-5 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-lg">Entrada / salida</h2>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setErr(null);
                  start(async () => {
                    const tipo = String(fd.get("tipo"));
                    const res = await recordMovementAction({
                      productId: String(fd.get("productId")),
                      tipo,
                      cantidad: Number(fd.get("cantidad")),
                      motivo: String(fd.get("motivo") || "") || null,
                    });
                    if (!res.ok) setErr(res.error);
                    else {
                      setMsg(
                        `Movimiento OK. Existencia: ${res.existencia}${res.bajoMinimo ? " (bajo mínimo)" : ""}`,
                      );
                      router.refresh();
                    }
                  });
                }}
              >
                <label className="block text-sm">
                  Producto
                  <select
                    name="productId"
                    required
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Tipo
                  <select
                    name="tipo"
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Cantidad
                  <input
                    name="cantidad"
                    type="number"
                    min={1}
                    required
                    defaultValue={1}
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Motivo
                  <input
                    name="motivo"
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending || products.length === 0}
                  className="bg-accent w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  Registrar movimiento
                </button>
              </form>
            </div>

            <div>
              <h2 className="font-serif text-lg">Venta en cita</h2>
              <p className="text-muted mt-1 text-sm">
                Crea línea de servicio tipo producto y descuenta stock.
              </p>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setErr(null);
                  start(async () => {
                    const res = await sellProductAction({
                      productId: String(fd.get("productId")),
                      appointmentId: String(fd.get("appointmentId")),
                      cantidad: Number(fd.get("cantidad") ?? 1),
                    });
                    if (!res.ok) setErr(res.error);
                    else {
                      setMsg("Venta registrada en la cita");
                      router.refresh();
                    }
                  });
                }}
              >
                <label className="block text-sm">
                  Producto
                  <select
                    name="productId"
                    required
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Cita
                  <select
                    name="appointmentId"
                    required
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  >
                    {appointments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Cantidad
                  <input
                    name="cantidad"
                    type="number"
                    min={1}
                    defaultValue={1}
                    className="border-brand/20 mt-1 w-full rounded-md border px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    pending || products.length === 0 || appointments.length === 0
                  }
                  className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  Vender
                </button>
              </form>
            </div>
          </section>
        </>
      ) : (
        <p className="text-muted text-sm">
          Solo admin/recepción gestionan catálogo y ventas. Puede registrar
          consumo de sesión vía API si aplica.
        </p>
      )}
    </div>
  );
}
