"use client";

import { useEffect, useState, useTransition } from "react";

import { listAuditLogsAction, type AuditLogRow } from "@/lib/audit/actions";
import { useToast } from "@/components/notifications/ToastProvider";

type Actor = { id: string; nombre: string };

export function AuditClient({
  initialRows,
  actors,
}: {
  initialRows: AuditLogRow[];
  actors: Actor[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [actorId, setActorId] = useState("");
  const [accion, setAccion] = useState("");
  const [resultado, setResultado] = useState<"todos" | "exito" | "error" | "info">(
    "todos",
  );
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [q, setQ] = useState("");

  function applyFilters() {
    startTransition(async () => {
      const res = await listAuditLogsAction({
        actorId,
        accion,
        resultado,
        desde,
        hasta,
        q,
        limit: 150,
      });
      if (!res.ok) {
        toast.error("Error al cargar auditoría", res.error);
        return;
      }
      setRows(res.rows);
    });
  }

  useEffect(() => {
    // Sincroniza con el prop cuando el server component revalida (ej. revalidatePath).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows);
  }, [initialRows]);

  const exitos = rows.filter((r) => r.resultado === "exito").length;
  const errores = rows.filter((r) => r.resultado === "error").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-brand/15 bg-surface rounded-xl border p-4">
          <p className="text-muted text-xs">Registros mostrados</p>
          <p className="text-brand mt-1 text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="border-brand/15 bg-surface rounded-xl border p-4">
          <p className="text-muted text-xs">Éxitos</p>
          <p className="text-verde mt-1 text-2xl font-semibold">{exitos}</p>
        </div>
        <div className="border-brand/15 bg-surface rounded-xl border p-4">
          <p className="text-muted text-xs">Errores</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{errores}</p>
        </div>
        <div className="border-brand/15 bg-surface rounded-xl border p-4">
          <p className="text-muted text-xs">Usuarios en filtro</p>
          <p className="text-foreground mt-1 text-2xl font-semibold">
            {new Set(rows.map((r) => r.actor_id).filter(Boolean)).size}
          </p>
        </div>
      </div>

      <form
        className="border-brand/15 bg-surface grid gap-3 rounded-xl border p-4 md:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
      >
        <label className="block text-sm md:col-span-1">
          <span className="text-muted mb-1 block text-xs">Usuario</span>
          <select
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block text-xs">Acción</span>
          <input
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            placeholder="ej. patient.create"
            className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block text-xs">Resultado</span>
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value as typeof resultado)}
            className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="exito">Éxito</option>
            <option value="error">Error</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block text-xs">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block text-xs">Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block text-xs">Buscar</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="mensaje, tabla…"
            className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
          />
        </label>
        <div className="flex w-full items-end md:col-span-3 lg:col-span-6">
          <button
            type="submit"
            disabled={pending}
            className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Filtrando…" : "Aplicar filtros"}
          </button>
        </div>
      </form>

      <div className="border-brand/15 bg-surface overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-brand/10 text-muted border-b">
            <tr>
              <th className="px-3 py-3 font-medium">Fecha</th>
              <th className="px-3 py-3 font-medium">Usuario</th>
              <th className="px-3 py-3 font-medium">Rol</th>
              <th className="px-3 py-3 font-medium">Acción</th>
              <th className="px-3 py-3 font-medium">Resultado</th>
              <th className="px-3 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-8 text-center">
                  Sin registros para estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((row) => <AuditRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditRow({ row }: { row: AuditLogRow }) {
  const fecha = new Date(row.created_at);
  return (
    <tr className="border-brand/10 border-b last:border-0">
      <td className="text-muted px-3 py-2.5 text-xs whitespace-nowrap">
        {fecha.toLocaleString("es-MX", {
          dateStyle: "short",
          timeStyle: "medium",
        })}
      </td>
      <td className="px-3 py-2.5">
        <p className="font-medium">{row.actor_nombre ?? "—"}</p>
        {row.ip ? <p className="text-muted text-xs">{row.ip}</p> : null}
      </td>
      <td className="text-muted px-3 py-2.5 text-xs">{row.rol ?? "—"}</td>
      <td className="px-3 py-2.5">
        <code className="text-xs">{row.accion}</code>
        {row.tabla ? (
          <p className="text-muted text-xs">
            {row.tabla}
            {row.registro_id ? ` · ${row.registro_id.slice(0, 8)}…` : ""}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <ResultBadge resultado={row.resultado} />
      </td>
      <td className="text-muted max-w-xs px-3 py-2.5 text-xs">
        {row.mensaje ?? (row.diff ? JSON.stringify(row.diff) : "—")}
      </td>
    </tr>
  );
}

function ResultBadge({ resultado }: { resultado: AuditLogRow["resultado"] }) {
  const styles =
    resultado === "exito"
      ? "bg-accent-soft text-foreground"
      : resultado === "error"
        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
        : "bg-brand-soft text-foreground";
  const label =
    resultado === "exito" ? "Éxito" : resultado === "error" ? "Error" : "Info";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
