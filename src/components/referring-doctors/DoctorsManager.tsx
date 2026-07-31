"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  createReferringDoctorAction,
  deactivateReferringDoctorAction,
  updateReferringDoctorAction,
} from "@/lib/referring-doctors/actions";

export type DoctorRow = {
  id: string;
  nombre: string;
  apellido: string;
  direccion: string | null;
  telefono: string | null;
  especialidad: string | null;
  activo: boolean;
};

export function DoctorsManager({ doctors }: { doctors: DoctorRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<DoctorRow | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const payload = {
            nombre: String(fd.get("nombre") ?? ""),
            apellido: String(fd.get("apellido") ?? ""),
            direccion: String(fd.get("direccion") ?? ""),
            telefono: String(fd.get("telefono") ?? ""),
            especialidad: String(fd.get("especialidad") ?? ""),
            activo: true,
          };
          startTransition(async () => {
            const res = editing
              ? await updateReferringDoctorAction({ id: editing.id, ...payload })
              : await createReferringDoctorAction(payload);
            toast.fromActionResult(
              res,
              editing ? "Doctor actualizado" : "Doctor registrado",
            );
            if (res.ok) {
              setEditing(null);
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <h2 className="font-semibold">
          {editing ? "Editar doctor" : "Nuevo doctor referido"}
        </h2>
        <p className="text-muted text-xs">
          Médicos externos que envían pacientes a la clínica.
        </p>
        <Field name="nombre" label="Nombre" defaultValue={editing?.nombre} required />
        <Field
          name="apellido"
          label="Apellido"
          defaultValue={editing?.apellido}
          required
        />
        <Field
          name="especialidad"
          label="Especialidad"
          defaultValue={editing?.especialidad ?? ""}
        />
        <Field
          name="telefono"
          label="Teléfono"
          defaultValue={editing?.telefono ?? ""}
        />
        <Field
          name="direccion"
          label="Dirección"
          defaultValue={editing?.direccion ?? ""}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {editing ? (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="border-brand/20 w-full rounded-md border px-4 py-2 text-sm sm:w-auto"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Guardando…" : editing ? "Guardar cambios" : "Registrar doctor"}
          </button>
        </div>
      </form>

      <div className="border-brand/15 bg-surface rounded-xl border p-5">
        <h2 className="font-semibold">Catálogo de doctores</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {doctors.length === 0 ? (
            <li className="text-muted">Aún no hay doctores registrados.</li>
          ) : (
            doctors.map((d) => (
              <li
                key={d.id}
                className="border-brand/10 flex flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {d.apellido}, {d.nombre}
                    {!d.activo ? (
                      <span className="text-muted ml-2 text-xs">(inactivo)</span>
                    ) : null}
                  </p>
                  <p className="text-muted text-xs">
                    {[d.especialidad, d.telefono, d.direccion]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <ActionButton
                    type="button"
                    variant="secondary"
                    inline
                    className="text-xs"
                    disabled={pending}
                    onClick={() => setEditing(d)}
                  >
                    Editar
                  </ActionButton>
                  {d.activo ? (
                    <ActionButton
                      type="button"
                      variant="danger"
                      inline
                      className="text-xs"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deactivateReferringDoctorAction(d.id);
                          toast.fromActionResult(res, "Doctor desactivado");
                          if (res.ok) {
                            setEditing(null);
                            router.refresh();
                          }
                        })
                      }
                    >
                      Desactivar
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <input
        key={`${name}-${defaultValue ?? ""}`}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
