"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { updatePatientContactAction } from "@/lib/patients/actions";

type DoctorOpt = { id: string; label: string };

type Contact = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  fechaNacimiento: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  ocupacion: string | null;
  referidoDoctorId: string | null;
  optInEmail: boolean;
  optInSms: boolean;
  optInWhatsapp: boolean;
};

export function ContactEditForm({
  patient,
  referringDoctors = [],
}: {
  patient: Contact;
  referringDoctors?: DoctorOpt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="border-brand/30 text-brand mt-4 w-full rounded-md border px-4 py-2 text-sm font-medium sm:w-auto"
      >
        Editar contacto
      </button>
    );
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await updatePatientContactAction({
            patientId: patient.id,
            nombre: String(fd.get("nombre") ?? ""),
            telefono: String(fd.get("telefono") ?? ""),
            email: String(fd.get("email") ?? ""),
            fechaNacimiento: String(fd.get("fechaNacimiento") ?? ""),
            contactoEmergenciaNombre: String(fd.get("contactoEmergenciaNombre") ?? ""),
            contactoEmergenciaTelefono: String(
              fd.get("contactoEmergenciaTelefono") ?? "",
            ),
            ocupacion: String(fd.get("ocupacion") ?? ""),
            referidoDoctorId: String(fd.get("referidoDoctorId") ?? ""),
            optInEmail: fd.get("optInEmail") === "on",
            optInSms: fd.get("optInSms") === "on",
            optInWhatsapp: fd.get("optInWhatsapp") === "on",
            optInPush: false,
          });
          toast.fromActionResult(res, "Contacto actualizado");
          if (res.ok) {
            setEditing(false);
            router.refresh();
          }
        });
      }}
    >
      <Field name="nombre" label="Nombre" defaultValue={patient.nombre} required />
      <Field name="telefono" label="Teléfono" defaultValue={patient.telefono} required />
      <Field name="email" label="Correo" defaultValue={patient.email ?? ""} type="email" />
      <Field
        name="fechaNacimiento"
        label="Fecha de nacimiento"
        defaultValue={patient.fechaNacimiento ?? ""}
        type="date"
      />
      <Field
        name="ocupacion"
        label="Ocupación"
        defaultValue={patient.ocupacion ?? ""}
      />
      <Field
        name="contactoEmergenciaNombre"
        label="Contacto de emergencia"
        defaultValue={patient.contactoEmergenciaNombre ?? ""}
      />
      <Field
        name="contactoEmergenciaTelefono"
        label="Tel. emergencia"
        defaultValue={patient.contactoEmergenciaTelefono ?? ""}
      />
      <label className="block text-sm">
        <span className="text-muted mb-1 block">Doctor referido</span>
        <select
          name="referidoDoctorId"
          defaultValue={patient.referidoDoctorId ?? ""}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        >
          <option value="">Sin referido</option>
          {referringDoctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <Check name="optInEmail" label="Email" defaultChecked={patient.optInEmail} />
        <Check name="optInSms" label="SMS" defaultChecked={patient.optInSms} />
        <Check
          name="optInWhatsapp"
          label="WhatsApp"
          defaultChecked={patient.optInWhatsapp}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="border-brand/20 w-full rounded-md border px-4 py-2 text-sm sm:w-auto"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Guardando…" : "Guardar contacto"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
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

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-[var(--brand)]"
      />
      {label}
    </label>
  );
}
