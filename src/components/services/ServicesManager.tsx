"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { formatCordobas } from "@/lib/money/format";
import {
  createServiceAction,
  seedDefaultServicesAction,
  toggleServiceActiveAction,
  updateServiceAction,
} from "@/lib/services/actions";
import { SERVICE_TIPO_OPTIONS } from "@/lib/services/schemas";

type ServiceRow = {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  costo: string;
  duracion_minutos: number | null;
  requiere_autorizacion: boolean;
  activo: boolean;
};

export function ServicesManager({
  services,
  isAdmin,
}: {
  services: ServiceRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="border-brand/15 bg-surface overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-brand/10 text-muted border-b">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Costo</th>
              <th className="px-4 py-3">Duración</th>
              <th className="px-4 py-3">Estado</th>
              {isAdmin ? <th className="px-4 py-3 text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-8 text-center">
                  Catálogo vacío.
                </td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="border-brand/5 border-b">
                  <td className="px-4 py-3 font-medium">{s.titulo}</td>
                  <td className="px-4 py-3">{s.tipo}</td>
                  <td className="px-4 py-3">{formatCordobas(s.costo)}</td>
                  <td className="px-4 py-3">
                    {s.duracion_minutos ? `${s.duracion_minutos} min` : "—"}
                  </td>
                  <td className="px-4 py-3">{s.activo ? "Activo" : "Inactivo"}</td>
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        <ActionButton
                          variant="secondary"
                          disabled={pending}
                          inline
                          className="text-xs"
                          onClick={() => setEditing(s)}
                        >
                          Editar
                        </ActionButton>
                        <ActionButton
                          variant={s.activo ? "danger" : "secondary"}
                          disabled={pending}
                          inline
                          className="text-xs"
                          onClick={() =>
                            startTransition(async () => {
                              const result = await toggleServiceActiveAction(
                                s.id,
                                !s.activo,
                              );
                              toast.fromActionResult(
                                result,
                                s.activo ? "Servicio desactivado" : "Servicio activado",
                              );
                              router.refresh();
                            })
                          }
                        >
                          {s.activo ? "Desactivar" : "Activar"}
                        </ActionButton>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAdmin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              startTransition(async () => {
                const result = await createServiceAction({
                  tipo: String(fd.get("tipo")),
                  titulo: String(fd.get("titulo")),
                  descripcion: String(fd.get("descripcion") ?? "") || undefined,
                  costo: String(fd.get("costo")),
                  duracionMinutos: fd.get("duracion")
                    ? Number(fd.get("duracion"))
                    : undefined,
                  requiereAutorizacion: fd.get("requiereAutorizacion") === "on",
                  activo: true,
                });
                toast.fromActionResult(result, "Servicio guardado");
                setMessage(result.ok ? "Servicio creado" : result.error);
                if (result.ok) {
                  form.reset();
                  router.refresh();
                }
              });
            }}
          >
            <h2 className="font-semibold">Nuevo servicio</h2>
            <TipoSelect name="tipo" />
            <Field name="titulo" label="Título" required />
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Descripción</span>
              <AutoTextarea
                name="descripcion"
                minRows={2}
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              />
            </label>
            <Field name="costo" label="Costo en C$ (ej. 500.00)" required />
            <Field name="duracion" label="Duración minutos" type="number" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiereAutorizacion" className="rounded" />
              <span>Requiere autorización</span>
            </label>
            <button
              type="submit"
              disabled={pending}
              className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white sm:w-auto"
            >
              Guardar
            </button>
          </form>

          <div className="border-brand/15 bg-surface rounded-xl border p-5">
            <h2 className="font-semibold">Catálogo sugerido</h2>
            <p className="text-muted mt-2 text-sm">
              Carga evaluación, sesiones, paquetes y estudio de movimiento.
            </p>
            <button
              type="button"
              disabled={pending || services.length > 0}
              className="border-brand/30 text-brand mt-4 w-full rounded-md border px-4 py-2 text-sm disabled:opacity-50 sm:w-auto"
              onClick={() =>
                startTransition(async () => {
                  const result = await seedDefaultServicesAction();
                  toast.fromActionResult(
                    result,
                    "Catálogo cargado",
                    result.ok ? `${result.count} servicios` : undefined,
                  );
                  setMessage(
                    result.ok ? `Se cargaron ${result.count} servicios` : result.error,
                  );
                  router.refresh();
                })
              }
            >
              Cargar catálogo inicial
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-muted text-sm">{message}</p> : null}

      {editing ? (
        <EditServiceModal
          service={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(payload) => {
            startTransition(async () => {
              const result = await updateServiceAction(payload);
              toast.fromActionResult(result, "Servicio actualizado");
              setMessage(result.ok ? "Servicio actualizado" : result.error);
              if (result.ok) {
                setEditing(null);
                router.refresh();
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

function EditServiceModal({
  service,
  pending,
  onClose,
  onSave,
}: {
  service: ServiceRow;
  pending: boolean;
  onClose: () => void;
  onSave: (payload: {
    id: string;
    tipo: string;
    titulo: string;
    descripcion?: string;
    costo: string;
    duracionMinutos?: number;
    requiereAutorizacion: boolean;
    activo: boolean;
  }) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-service-title"
    >
      <form
        className="bg-surface text-foreground max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-brand/20 p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const duracionRaw = String(fd.get("duracion") ?? "").trim();
          onSave({
            id: service.id,
            tipo: String(fd.get("tipo")),
            titulo: String(fd.get("titulo")),
            descripcion: String(fd.get("descripcion") ?? "") || undefined,
            costo: String(fd.get("costo")),
            duracionMinutos: duracionRaw ? Number(duracionRaw) : undefined,
            requiereAutorizacion: fd.get("requiereAutorizacion") === "on",
            activo: fd.get("activo") === "on",
          });
        }}
      >
        <h2 id="edit-service-title" className="text-lg font-semibold">
          Editar servicio
        </h2>
        <p className="text-muted text-xs">
          Los cambios actualizan el precio de lista. Las citas ya cobradas conservan
          su `costo_aplicado`.
        </p>

        <TipoSelect name="tipo" defaultValue={service.tipo} />
        <Field
          name="titulo"
          label="Título"
          required
          defaultValue={service.titulo}
        />
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Descripción</span>
          <AutoTextarea
            name="descripcion"
            minRows={2}
            defaultValue={service.descripcion ?? ""}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
        <Field
          name="costo"
          label="Costo en C$ (ej. 500.00)"
          required
          defaultValue={service.costo}
        />
        <Field
          name="duracion"
          label="Duración minutos"
          type="number"
          defaultValue={
            service.duracion_minutos != null ? String(service.duracion_minutos) : ""
          }
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiereAutorizacion"
            defaultChecked={service.requiere_autorizacion}
            className="rounded"
          />
          <span>Requiere autorización</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={service.activo}
            className="rounded"
          />
          <span>Activo en catálogo</span>
        </label>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <ActionButton type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </ActionButton>
        </div>
      </form>
    </div>
  );
}

function TipoSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">Tipo</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      >
        {SERVICE_TIPO_OPTIONS.map((tipo) => (
          <option key={tipo} value={tipo}>
            {tipo}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
