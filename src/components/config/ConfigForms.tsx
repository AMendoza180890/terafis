"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { updateClinicConfigAction } from "@/lib/config/actions";

type Initial = {
  nombre: string;
  timezone: string;
  direccion: string;
  telefono: string;
  rfc: string;
  temaDefecto: "claro" | "oscuro" | "sistema";
};

export function ConfigForms({ initial }: { initial: Initial }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="max-w-xl">
      <form
        className="border-brand/15 bg-surface space-y-3 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setMessage(null);
          startTransition(async () => {
            const result = await updateClinicConfigAction({
              nombre: String(fd.get("nombre")),
              timezone: String(fd.get("timezone")),
              direccion: String(fd.get("direccion")),
              telefono: String(fd.get("telefono")),
              rfc: String(fd.get("rfc")),
              temaDefecto: String(fd.get("temaDefecto")),
            });
            toast.fromActionResult(result, "Configuración guardada");
            setMessage(result.ok ? "Configuración guardada." : result.error);
            if (result.ok) router.refresh();
          });
        }}
      >
        <h2 className="font-semibold">Datos de la clínica</h2>
        <Field name="nombre" label="Nombre" defaultValue={initial.nombre} required />
        <Field
          name="timezone"
          label="Timezone (IANA)"
          defaultValue={initial.timezone}
          required
        />
        <Field name="direccion" label="Dirección" defaultValue={initial.direccion} />
        <Field name="telefono" label="Teléfono" defaultValue={initial.telefono} />
        <Field name="rfc" label="RFC" defaultValue={initial.rfc} />
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Tema por defecto</span>
          <select
            name="temaDefecto"
            defaultValue={initial.temaDefecto}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          >
            <option value="sistema">sistema</option>
            <option value="claro">claro</option>
            <option value="oscuro">oscuro</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white sm:w-auto"
        >
          Guardar clínica
        </button>
      </form>

      {message ? <p className="text-muted mt-3 text-sm">{message}</p> : null}
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
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
