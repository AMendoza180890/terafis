"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ClinicalPanel } from "@/components/patients/ClinicalPanel";
import { SessionNotesPanel } from "@/components/patients/SessionNotesPanel";
import { useToast } from "@/components/notifications/ToastProvider";
import {
  closePatientClinicalEpisodeAction,
  createPatientClinicalEpisodeAction,
  type ClinicalEpisodeSummary,
} from "@/lib/patients/actions";

type AppointmentOpt = { id: string; label: string };
type ServiceOpt = { id: string; titulo: string; costo: string };
type ActiveConsultation = {
  queueId: string;
  appointmentId: string;
  version: number;
  patientNombre: string;
  estado: "pendiente" | "en_sala_espera" | "en_consulta";
};

type Props = {
  patientId: string;
  initialEpisodes: ClinicalEpisodeSummary[];
  initialClinicalId?: string | null;
  appointments: AppointmentOpt[];
  timezone: string;
  services: ServiceOpt[];
  activeConsultation: ActiveConsultation | null;
  canFinalizeConsultation: boolean;
  canWriteClinical: boolean;
  canManageEpisodes: boolean;
  canWriteSessionNotes: boolean;
  multiExpedienteEnabled?: boolean;
  loadError?: string | null;
};

export function ClinicalEpisodesWorkspace({
  patientId,
  initialEpisodes,
  initialClinicalId,
  appointments,
  timezone,
  services,
  activeConsultation,
  canFinalizeConsultation,
  canWriteClinical,
  canManageEpisodes,
  canWriteSessionNotes,
  multiExpedienteEnabled = true,
  loadError = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [newTitle, setNewTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setEpisodes(initialEpisodes);
  }, [initialEpisodes]);

  const defaultId = useMemo(() => {
    if (
      initialClinicalId &&
      initialEpisodes.some((e) => e.id === initialClinicalId)
    ) {
      return initialClinicalId;
    }
    const activo = initialEpisodes.find((e) => e.estado === "activo");
    return activo?.id ?? initialEpisodes[0]?.id ?? null;
  }, [initialClinicalId, initialEpisodes]);

  const [selectedId, setSelectedId] = useState<string | null>(defaultId);

  useEffect(() => {
    if (defaultId && (!selectedId || !episodes.some((e) => e.id === selectedId))) {
      setSelectedId(defaultId);
    }
  }, [defaultId, selectedId, episodes]);

  const selected = episodes.find((e) => e.id === selectedId) ?? null;
  const isClosed = selected?.estado === "cerrado";

  function createEpisode() {
    const titulo = newTitle.trim() || "Expediente clínico";
    startTransition(async () => {
      const res = await createPatientClinicalEpisodeAction({
        patientId,
        titulo,
      });
      toast.fromActionResult(res, "Expediente creado");
      if (!res.ok) return;
      const episode: ClinicalEpisodeSummary = {
        id: res.id,
        titulo,
        estado: "activo",
        fechaApertura: new Date().toISOString().slice(0, 10),
        fechaCierre: null,
        createdAt: new Date().toISOString(),
      };
      setEpisodes((prev) => [episode, ...prev]);
      setSelectedId(res.id);
      setNewTitle("");
      setShowCreate(false);
      router.refresh();
    });
  }

  function closeEpisode() {
    if (!selectedId || isClosed) return;
    if (
      !window.confirm(
        "¿Cerrar este expediente? No se podrán agregar más seguimientos.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await closePatientClinicalEpisodeAction(
        patientId,
        selectedId,
      );
      toast.fromActionResult(res, "Expediente cerrado");
      if (!res.ok) return;
      const today = new Date().toISOString().slice(0, 10);
      setEpisodes((prev) =>
        prev.map((e) =>
          e.id === selectedId
            ? { ...e, estado: "cerrado", fechaCierre: today }
            : e,
        ),
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-8" id="expedientes">
      <section className="border-brand/15 bg-surface rounded-xl border p-5">
        {!multiExpedienteEnabled ? (
          <p className="bg-brand-soft mb-4 rounded-md px-3 py-2 text-xs">
            Puede ver el expediente y seguimientos actuales. Para crear varios
            expedientes por paciente, aplique la migración{" "}
            <code className="font-mono">20260730300000_multi_expediente_clinico.sql</code>{" "}
            en Supabase → SQL Editor.
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Expedientes clínicos</h2>
            <p className="text-muted mt-1 text-sm">
              {multiExpedienteEnabled
                ? "Seleccione un expediente para ver su contenido y seguimientos."
                : "Expediente y seguimientos del paciente."}
            </p>
          </div>
          {canManageEpisodes && multiExpedienteEnabled ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowCreate((v) => !v)}
              className="bg-brand rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Nuevo expediente
            </button>
          ) : null}
        </div>

        {showCreate ? (
          <div className="border-brand/15 mt-4 flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <label className="block min-w-[220px] flex-1 text-sm">
              <span className="text-muted mb-1 block text-xs">
                Título / motivo
              </span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Lumbalgia post-caída"
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={createEpisode}
              className="bg-brand rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="border-brand/20 rounded-md border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        ) : null}

        {loadError ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            No se pudieron cargar expedientes: {loadError}
          </p>
        ) : null}

        {episodes.length === 0 ? (
          <p className="text-muted mt-4 text-sm">
            Sin expedientes registrados para este paciente.
            {canManageEpisodes && multiExpedienteEnabled
              ? " Cree el primero para registrar evolución y seguimientos."
              : null}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {episodes.map((e) => {
              const active = e.id === selectedId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={[
                    "rounded-md px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-brand text-white"
                      : "border-brand/20 border",
                  ].join(" ")}
                >
                  <span className="block font-medium">{e.titulo}</span>
                  <span
                    className={[
                      "text-xs",
                      active ? "text-white/80" : "text-muted",
                    ].join(" ")}
                  >
                    {e.estado === "activo" ? "Activo" : "Cerrado"} ·{" "}
                    {e.fechaApertura}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <>
          <section className="border-brand/15 bg-surface rounded-xl border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Expediente clínico</h2>
                <p className="text-muted mt-1 text-sm">
                  {selected.titulo}
                  {isClosed ? " · cerrado" : " · activo"}
                </p>
              </div>
              {canManageEpisodes && multiExpedienteEnabled && !isClosed ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={closeEpisode}
                  className="border-brand/20 rounded-md border px-3 py-2 text-sm"
                >
                  Cerrar expediente
                </button>
              ) : null}
            </div>
            <ClinicalPanel
              patientId={patientId}
              clinicalId={selected.id}
              readOnly={!canWriteClinical || isClosed}
            />
          </section>

          <section className="border-brand/15 bg-surface rounded-xl border p-5">
            <h2 className="font-semibold">Seguimiento y evolución</h2>
            <p className="text-muted mt-1 text-sm">
              {canWriteSessionNotes && !isClosed
                ? "Notas de este expediente: tratamiento, observaciones e historial."
                : isClosed
                  ? "Historial del expediente cerrado (solo consulta)."
                  : "Consulta del historial registrado por el fisioterapeuta."}
            </p>
            <div className="mt-4">
              <SessionNotesPanel
                patientId={patientId}
                clinicalId={selected.id}
                appointments={appointments}
                timezone={timezone}
                services={services}
                activeConsultation={activeConsultation}
                canFinalizeConsultation={canFinalizeConsultation}
                readOnly={!canWriteSessionNotes || isClosed}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
