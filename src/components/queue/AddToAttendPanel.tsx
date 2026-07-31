"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { searchPatientsAction } from "@/lib/patients/actions";
import { addPatientToAttendAction } from "@/lib/queue/actions";

type Option = { id: string; label: string };
type PatientHit = { id: string; nombre: string; telefono: string; email: string | null };

type Props = {
  therapists: Option[];
  timezone: string;
  /** Si se pasa, el paciente ya está fijo (ficha). */
  fixedPatient?: { id: string; nombre: string } | null;
};

export function AddToAttendPanel({
  therapists,
  timezone,
  fixedPatient = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [selected, setSelected] = useState<PatientHit | null>(
    fixedPatient
      ? {
          id: fixedPatient.id,
          nombre: fixedPatient.nombre,
          telefono: "",
          email: null,
        }
      : null,
  );
  const [terapeutaId, setTerapeutaId] = useState(therapists[0]?.id ?? "");
  const [notas, setNotas] = useState("");

  function search() {
    if (fixedPatient) return;
    startTransition(async () => {
      const res = await searchPatientsAction({ q, limit: 15 });
      if (!res.ok) {
        toast.error("Búsqueda", res.error);
        setHits([]);
        return;
      }
      setHits(res.patients);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const patientId = fixedPatient?.id ?? selected?.id;
    if (!patientId) {
      toast.error("Seleccione un paciente");
      return;
    }
    if (!terapeutaId) {
      toast.error("Seleccione un terapeuta");
      return;
    }
    startTransition(async () => {
      const res = await addPatientToAttendAction({
        patientId,
        terapeutaId,
        notasAdmin: notas || undefined,
        timezone,
        duracionMinutos: 60,
      });
      toast.fromActionResult(
        res,
        "Paciente en lista de atención",
        res.ok ? "Sincronizado en la cola de hoy" : undefined,
      );
      if (res.ok) {
        setNotas("");
        if (!fixedPatient) {
          setSelected(null);
          setQ("");
          setHits([]);
        }
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="border-brand/15 bg-surface space-y-3 rounded-xl border p-4"
    >
      <div>
        <h2 className="font-semibold">Agregar a lista de atención</h2>
        <p className="text-muted mt-1 text-xs">
          Busque un paciente registrado, asígnelo a un terapeuta y envíelo a la cola
          de hoy.
        </p>
      </div>

      {fixedPatient ? (
        <p className="text-sm">
          Paciente: <span className="font-medium">{fixedPatient.nombre}</span>
        </p>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-muted mb-1 block">Buscar paciente</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
                placeholder="Nombre o teléfono"
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              />
              <button
                type="button"
                disabled={pending || q.trim().length === 0}
                onClick={search}
                className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                Buscar
              </button>
            </div>
          </label>
          {hits.length > 0 ? (
            <ul className="border-brand/15 max-h-40 overflow-y-auto rounded-md border text-sm">
              {hits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className={[
                      "hover:bg-brand-soft w-full px-3 py-2 text-left",
                      selected?.id === p.id ? "bg-brand-soft font-medium" : "",
                    ].join(" ")}
                  >
                    {p.nombre}
                    <span className="text-muted ml-2 text-xs">{p.telefono}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selected ? (
            <p className="text-sm">
              Seleccionado: <span className="font-medium">{selected.nombre}</span>
            </p>
          ) : null}
        </div>
      )}

      <label className="block text-sm">
        <span className="text-muted mb-1 block">Terapeuta</span>
        <select
          required
          value={terapeutaId}
          onChange={(e) => setTerapeutaId(e.target.value)}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        >
          {therapists.length === 0 ? (
            <option value="">Sin terapeutas</option>
          ) : (
            therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-muted mb-1 block">Notas administrativas</span>
        <AutoTextarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          minRows={2}
          className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending || therapists.length === 0}
        className="bg-brand w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Agregando…" : "Agregar a cola de hoy"}
      </button>
    </form>
  );
}
