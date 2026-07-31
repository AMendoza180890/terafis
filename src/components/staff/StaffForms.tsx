"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { CedulaNiInput } from "@/components/ui/CedulaNiInput";
import {
  addStaffScheduleAction,
  createStaffProfileAction,
  setMfaForceReenrollAction,
} from "@/lib/config/actions";
import { formatCedulaNiInput } from "@/lib/validation/cedula-ni";

export function StaffForms({
  members,
}: {
  members: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        key={formKey}
        className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const password = String(fd.get("password") ?? "");
          const passwordConfirm = String(fd.get("passwordConfirm") ?? "");
          if (password !== passwordConfirm) {
            setMessage("Las contraseñas no coinciden.");
            toast.error("Las contraseñas no coinciden.");
            return;
          }
          setMessage(null);
          startTransition(async () => {
            const result = await createStaffProfileAction({
              nombre: String(fd.get("nombre")),
              email: String(fd.get("email")),
              password,
              telefono: String(fd.get("telefono") ?? ""),
              rol: String(fd.get("rol")),
              especialidad: String(fd.get("especialidad") ?? ""),
              cedulaProfesional: formatCedulaNiInput(
                String(fd.get("cedula") ?? ""),
              ),
            });
            toast.fromActionResult(result, "Usuario creado");
            setMessage(
              result.ok
                ? "Usuario creado. Ya puede iniciar sesión."
                : result.error,
            );
            if (result.ok) {
              setFormKey((k) => k + 1);
              router.refresh();
            }
          });
        }}
      >
        <h2 className="font-semibold">Crear usuario</h2>
        <p className="text-muted text-xs">
          Se crea la cuenta de acceso y el perfil de staff desde aquí. El
          usuario podrá iniciar sesión de inmediato.
        </p>
        <Input name="nombre" label="Nombre" required />
        <Input name="email" label="Correo" type="email" required />
        <Input
          name="password"
          label="Contraseña"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input
          name="passwordConfirm"
          label="Confirmar contraseña"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input name="telefono" label="Teléfono" />
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Rol</span>
          <select
            name="rol"
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
            defaultValue="terapeuta"
          >
            <option value="terapeuta">Terapeuta</option>
            <option value="recepcionista">Recepcionista</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <Input name="especialidad" label="Especialidad" />
        <CedulaNiInput name="cedula" label="Cédula" />
        <button
          type="submit"
          disabled={pending}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white sm:w-auto"
        >
          {pending ? "Creando…" : "Crear usuario"}
        </button>
      </form>

      <form
        className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setMessage(null);
          startTransition(async () => {
            const result = await addStaffScheduleAction({
              staffId: String(fd.get("staffId")),
              diaSemana: Number(fd.get("diaSemana")),
              horaInicio: String(fd.get("horaInicio")),
              horaFin: String(fd.get("horaFin")),
            });
            toast.fromActionResult(result, "Horario añadido");
            setMessage(result.ok ? "Horario añadido." : result.error);
            if (result.ok) router.refresh();
          });
        }}
      >
        <h2 className="font-semibold">Horario laboral</h2>
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Staff</span>
          <select
            name="staffId"
            required
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Día</span>
          <select
            name="diaSemana"
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          >
            {[
              "Domingo",
              "Lunes",
              "Martes",
              "Miércoles",
              "Jueves",
              "Viernes",
              "Sábado",
            ].map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Input name="horaInicio" label="Inicio" type="time" required />
          <Input name="horaFin" label="Fin" type="time" required />
        </div>
        <button
          type="submit"
          disabled={pending || members.length === 0}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white sm:w-auto"
        >
          Añadir bloque
        </button>

        <div className="border-brand/10 border-t pt-4">
          <h3 className="text-sm font-semibold">Forzar reinscripción MFA</h3>
          <label className="mt-2 block text-sm">
            <span className="text-muted mb-1 block">Staff</span>
            <select
              id="mfaStaff"
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              defaultValue={members[0]?.id}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || members.length === 0}
            className="border-brand/30 text-brand mt-3 w-full rounded-md border px-4 py-2 text-sm sm:w-auto"
            onClick={() => {
              const el = document.getElementById(
                "mfaStaff",
              ) as HTMLSelectElement | null;
              if (!el?.value) return;
              startTransition(async () => {
                const result = await setMfaForceReenrollAction(el.value, true);
                toast.fromActionResult(result, "MFA actualizado");
                setMessage(
                  result.ok
                    ? "MFA marcado para reinscripción."
                    : result.error,
                );
                if (result.ok) router.refresh();
              });
            }}
          >
            Forzar MFA
          </button>
        </div>
      </form>

      {message ? (
        <p className="text-muted text-sm lg:col-span-2">{message}</p>
      ) : null}
    </div>
  );
}

function Input({
  name,
  label,
  type = "text",
  required,
  minLength,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
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
        minLength={minLength}
        autoComplete={autoComplete}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
