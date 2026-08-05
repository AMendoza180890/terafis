"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { CLINICAL_FIELD_LABELS } from "@/lib/labels/clinical";
import { createPatientAction } from "@/lib/patients/actions";

type DoctorOpt = { id: string; label: string };

type Props = {
  canEditClinical: boolean;
  /** Selector de referido (recepción/admin). */
  showReferral?: boolean;
  referringDoctors?: DoctorOpt[];
};

export function PatientForm({
  canEditClinical,
  showReferral = false,
  referringDoctors = [],
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const payload = {
      nombre: String(fd.get("nombre") ?? ""),
      telefono: String(fd.get("telefono") ?? ""),
      email: String(fd.get("email") ?? ""),
      fechaNacimiento: String(fd.get("fechaNacimiento") ?? ""),
      contactoEmergenciaNombre: String(fd.get("contactoEmergenciaNombre") ?? ""),
      contactoEmergenciaTelefono: String(fd.get("contactoEmergenciaTelefono") ?? ""),
      ocupacion: String(fd.get("ocupacion") ?? ""),
      referidoDoctorId: String(fd.get("referidoDoctorId") ?? ""),
      optInEmail: fd.get("optInEmail") === "on",
      optInSms: fd.get("optInSms") === "on",
      optInWhatsapp: fd.get("optInWhatsapp") === "on",
      optInPush: fd.get("optInPush") === "on",
      clinical: canEditClinical
        ? {
            historialMedico: String(fd.get("historialMedico") ?? ""),
            alergias: String(fd.get("alergias") ?? ""),
            medicamentos: String(fd.get("medicamentos") ?? ""),
            diagnosticosPrevios: String(fd.get("diagnosticosPrevios") ?? ""),
            anamnesis: String(fd.get("anamnesis") ?? ""),
            exploracionFisica: String(fd.get("exploracionFisica") ?? ""),
            diagnosticoFisioterapeutico: String(
              fd.get("diagnosticoFisioterapeutico") ?? "",
            ),
            objetivoTratamiento: String(fd.get("objetivoTratamiento") ?? ""),
          }
        : undefined,
      consent: {
        tipo: "aviso_privacidad" as const,
        versionDocumento: "2026.1",
        textoHash: "aviso_privacidad_v2026_1_placeholder_hash_sha256",
      },
    };

    startTransition(async () => {
      const result = await createPatientAction(payload);
      toast.fromActionResult(result, "Paciente guardado", "Registro creado correctamente.");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/app/pacientes/${result.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Datos de contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" name="nombre" required />
          <Field label="Teléfono" name="telefono" required />
          <Field label="Correo" name="email" type="email" />
          <Field label="Fecha de nacimiento" name="fechaNacimiento" type="date" />
          <Field label="Contacto de emergencia" name="contactoEmergenciaNombre" />
          <Field label="Tel. emergencia" name="contactoEmergenciaTelefono" />
          <Field label="Ocupación" name="ocupacion" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Preferencias de contacto</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <Check label="Email" name="optInEmail" />
          <Check label="SMS" name="optInSms" />
          <Check label="WhatsApp" name="optInWhatsapp" />
          <Check label="Push" name="optInPush" />
        </div>
      </section>

      {showReferral ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Referido</h2>
          <p className="text-muted text-sm">
            Seleccione el doctor que refiere al paciente a la clínica.
          </p>
          <label className="block text-sm">
            <span className="text-muted mb-1 block">Doctor referido</span>
            <select
              name="referidoDoctorId"
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
          {referringDoctors.length === 0 ? (
            <p className="text-muted text-xs">
              No hay doctores activos. Regístrelos en{" "}
              <Link href="/app/doctores" className="text-brand underline">
                Doctores referidos
              </Link>
              .
            </p>
          ) : null}
        </section>
      ) : null}

      {canEditClinical ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Expediente clínico (cifrado)</h2>
          <p className="text-muted text-sm">
            Solo visible para admin y terapeutas. Se cifra antes de guardar.
          </p>
          <TextArea
            label={CLINICAL_FIELD_LABELS.historialMedico}
            name="historialMedico"
          />
          <TextArea label={CLINICAL_FIELD_LABELS.alergias} name="alergias" />
          <TextArea
            label={CLINICAL_FIELD_LABELS.medicamentos}
            name="medicamentos"
          />
          <TextArea
            label={CLINICAL_FIELD_LABELS.diagnosticosPrevios}
            name="diagnosticosPrevios"
          />
          <Field
            label={CLINICAL_FIELD_LABELS.anamnesis}
            name="anamnesis"
            type="number"
            min={0}
            max={10}
            step={1}
            inputMode="numeric"
          />
          <TextArea
            label={CLINICAL_FIELD_LABELS.exploracionFisica}
            name="exploracionFisica"
          />
          <TextArea
            label={CLINICAL_FIELD_LABELS.diagnosticoFisioterapeutico}
            name="diagnosticoFisioterapeutico"
          />
          <TextArea
            label={CLINICAL_FIELD_LABELS.objetivoTratamiento}
            name="objetivoTratamiento"
          />
        </section>
      ) : (
        <p className="bg-brand-soft/50 text-muted rounded-md p-3 text-sm">
          Como recepción no puede cargar ni ver contenido clínico.
        </p>
      )}

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand w-full rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Registrar paciente"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  min,
  max,
  step,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  inputMode?: "numeric" | "text" | "tel" | "email";
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        className="border-brand/20 bg-background ring-brand w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
    </label>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <AutoTextarea
        name={name}
        minRows={2}
        className="border-brand/20 bg-background ring-brand w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
    </label>
  );
}

function Check({ label, name }: { label: string; name: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" name={name} className="accent-[var(--brand)]" />
      {label}
    </label>
  );
}
