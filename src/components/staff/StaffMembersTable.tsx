"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { CedulaNiInput } from "@/components/ui/CedulaNiInput";
import { setStaffActiveAction, updateStaffProfileAction } from "@/lib/config/actions";
import { formatCedulaNiInput } from "@/lib/validation/cedula-ni";

export type StaffMemberRow = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: string;
  especialidad: string | null;
  cedula_profesional: string | null;
  mfa_habilitado: boolean;
  mfa_forzar_reinscripcion: boolean;
  activo: boolean;
  horario: string;
};

type Props = {
  members: StaffMemberRow[];
  currentStaffId: string;
  canManage: boolean;
};

export function StaffMembersTable({ members, currentStaffId, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<StaffMemberRow | null>(null);

  function toggleActive(m: StaffMemberRow) {
    const next = !m.activo;
    const label = next ? "activar" : "desactivar";
    if (
      !window.confirm(
        next
          ? `¿Activar a ${m.nombre}? Podrá iniciar sesión de nuevo.`
          : `¿Desactivar a ${m.nombre}? No podrá usar el sistema.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setStaffActiveAction({
        staffId: m.id,
        activo: next,
      });
      toast.fromActionResult(result, next ? "Usuario activado" : "Usuario desactivado");
      if (result.ok) router.refresh();
      else toast.error(`No se pudo ${label}`, result.error);
    });
  }

  return (
    <>
      <div className="border-brand/15 bg-surface overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-brand/10 text-muted border-b">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Especialidad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">MFA</th>
              <th className="px-4 py-3">Horario</th>
              {canManage ? <th className="px-4 py-3">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 7 : 6}
                  className="text-muted px-4 py-8 text-center"
                >
                  Sin personal registrado. Cree el primer usuario desde el formulario.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.id}
                  className={[
                    "border-brand/5 border-b",
                    m.activo ? "" : "opacity-60",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{m.nombre}</p>
                    <p className="text-muted text-xs">{m.email}</p>
                    {m.cedula_profesional ? (
                      <p className="text-muted font-mono text-xs">
                        {m.cedula_profesional}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 capitalize">{m.rol}</td>
                  <td className="px-4 py-3">{m.especialidad ?? "—"}</td>
                  <td className="px-4 py-3">
                    {m.activo ? (
                      <span className="text-accent font-medium">Activo</span>
                    ) : (
                      <span className="text-muted">Desactivado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.mfa_habilitado ? "Activo" : "Pendiente"}
                    {m.mfa_forzar_reinscripcion ? " · reinscribir" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">{m.horario || "—"}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setEditing(m)}
                          className="border-brand/20 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending || (m.activo && m.id === currentStaffId)}
                          title={
                            m.activo && m.id === currentStaffId
                              ? "No puede desactivar su propia cuenta"
                              : undefined
                          }
                          onClick={() => toggleActive(m)}
                          className={[
                            "rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60",
                            m.activo
                              ? "border-red-300 text-red-700"
                              : "border-brand/20 text-brand",
                          ].join(" ")}
                        >
                          {m.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <EditStaffModal
          member={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            startTransition(async () => {
              const result = await updateStaffProfileAction(payload);
              toast.fromActionResult(result, "Usuario actualizado");
              if (result.ok) {
                setEditing(null);
                router.refresh();
              }
            });
          }}
        />
      ) : null}
    </>
  );
}

function EditStaffModal({
  member,
  pending,
  onClose,
  onSubmit,
}: {
  member: StaffMemberRow;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    staffId: string;
    nombre: string;
    email: string;
    telefono: string;
    rol: string;
    especialidad: string;
    cedulaProfesional: string;
    password?: string;
  }) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-staff-title"
      onClick={onClose}
    >
      <form
        className="bg-surface border-brand/20 max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            staffId: member.id,
            nombre: String(fd.get("nombre") ?? ""),
            email: String(fd.get("email") ?? ""),
            telefono: String(fd.get("telefono") ?? ""),
            rol: String(fd.get("rol") ?? ""),
            especialidad: String(fd.get("especialidad") ?? ""),
            cedulaProfesional: formatCedulaNiInput(String(fd.get("cedula") ?? "")),
            password: String(fd.get("password") ?? ""),
          });
        }}
      >
        <h2 id="edit-staff-title" className="font-semibold">
          Editar usuario
        </h2>
        <p className="text-muted text-xs">
          Actualice los datos del personal. La contraseña es opcional.
        </p>

        <Field name="nombre" label="Nombre" defaultValue={member.nombre} required />
        <Field
          name="email"
          label="Correo"
          type="email"
          defaultValue={member.email}
          required
        />
        <Field name="telefono" label="Teléfono" defaultValue={member.telefono ?? ""} />
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Rol</span>
          <select
            name="rol"
            defaultValue={member.rol}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          >
            <option value="terapeuta">Terapeuta</option>
            <option value="recepcionista">Recepcionista</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <Field
          name="especialidad"
          label="Especialidad"
          defaultValue={member.especialidad ?? ""}
        />
        <CedulaNiInput
          key={`cedula-${member.id}`}
          name="cedula"
          label="Cédula"
          defaultValue={member.cedula_profesional ?? ""}
        />
        <Field
          name="password"
          label="Nueva contraseña (opcional)"
          type="password"
          minLength={8}
          autoComplete="new-password"
        />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="border-brand/20 rounded-md border px-4 py-2 text-sm disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-brand rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Actualizar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  minLength,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
        autoComplete={autoComplete}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
