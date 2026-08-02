"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import {
  emptyPlanForm,
  TreatmentPlanFields,
  type PlanFormState,
} from "@/components/plans/TreatmentPlanFields";
import { FinalizeServicesModal } from "@/components/queue/FinalizeServicesModal";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { formatInClinicTz, DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { updateQueueEstadoAction } from "@/lib/queue/actions";
import {
  createSessionNoteAction,
  listSessionNotesAction,
  updateSessionNoteAction,
  type SessionNoteView,
} from "@/lib/session-notes/actions";
import { getLatestTreatmentPlanForPatientAction } from "@/lib/treatment-plans/actions";

type AppointmentOpt = { id: string; label: string };
type ServiceOpt = { id: string; titulo: string; costo: string };
type ActiveConsultation = {
  queueId: string;
  appointmentId: string;
  version: number;
  patientNombre: string;
  estado: "pendiente" | "en_sala_espera" | "en_consulta";
};

type FormState = {
  appointmentId: string;
  notasEvolucion: string;
  tratamiento: string;
  observaciones: string;
  rangoMovimiento: string;
  dolorEva: string;
};

const emptyForm = (): FormState => ({
  appointmentId: "",
  notasEvolucion: "",
  tratamiento: "",
  observaciones: "",
  rangoMovimiento: "",
  dolorEva: "",
});

type Props = {
  patientId: string;
  clinicalId: string;
  appointments: AppointmentOpt[];
  timezone?: string;
  services?: ServiceOpt[];
  activeConsultation?: ActiveConsultation | null;
  canFinalizeConsultation?: boolean;
  /** Solo fisioterapeuta. */
  canStartConsultation?: boolean;
  /** Recepción: solo historial visible, sin crear/editar/finalizar. */
  readOnly?: boolean;
};

export function SessionNotesPanel({
  patientId,
  clinicalId,
  appointments,
  timezone = DEFAULT_TZ,
  services = [],
  activeConsultation = null,
  canFinalizeConsultation = false,
  canStartConsultation = false,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<SessionNoteView[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [atencion, setAtencion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm(),
    appointmentId: activeConsultation?.appointmentId ?? "",
  }));
  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm);
  /** null = nuevo; string = nota guardada (bloqueada o en edición). */
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [showFinalize, setShowFinalize] = useState(false);
  const [consultation, setConsultation] = useState(activeConsultation);

  useEffect(() => {
    // Sincroniza con el prop cuando cambia la consulta activa en cola.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsultation(activeConsultation);
  }, [activeConsultation]);

  useEffect(() => {
    if (!savedNoteId && activeConsultation?.appointmentId) {
      // Precarga la cita de la consulta activa en el formulario nuevo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) =>
        prev.appointmentId
          ? prev
          : { ...prev, appointmentId: activeConsultation.appointmentId },
      );
    }
  }, [activeConsultation, savedNoteId]);

  function loadLatestPlan() {
    startTransition(async () => {
      const res = await getLatestTreatmentPlanForPatientAction(patientId);
      if (!res.ok || !res.plan) return;
      setPlanForm({
        diagnostico: res.plan.diagnostico,
        objetivo: res.plan.objetivo,
        frecuencia: res.plan.frecuencia,
        semanas:
          res.plan.duracionEstimadaSemanas != null
            ? String(res.plan.duracionEstimadaSemanas)
            : "",
        ejerciciosDetalle: res.plan.ejerciciosDetalle,
      });
    });
  }

  function load() {
    startTransition(async () => {
      const res = await listSessionNotesAction({
        patientId,
        clinicalId,
        desde,
        hasta,
        atencion,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error("Historial", res.error);
        return;
      }
      setError(null);
      setNotes(res.notes);
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const res = await listSessionNotesAction({ patientId, clinicalId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setNotes(res.notes);
      setSavedNoteId(null);
      setEditing(true);
      setForm({
        ...emptyForm(),
        appointmentId: activeConsultation?.appointmentId ?? "",
      });
      setPlanForm(emptyPlanForm());
      const planRes = await getLatestTreatmentPlanForPatientAction(patientId);
      if (planRes.ok && planRes.plan) {
        setPlanForm({
          diagnostico: planRes.plan.diagnostico,
          objetivo: planRes.plan.objetivo,
          frecuencia: planRes.plan.frecuencia,
          semanas:
            planRes.plan.duracionEstimadaSemanas != null
              ? String(planRes.plan.duracionEstimadaSemanas)
              : "",
          ejerciciosDetalle: planRes.plan.ejerciciosDetalle,
        });
      }
    });
  }, [patientId, clinicalId]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function beginEdit() {
    setEditing(true);
  }

  function beginNew() {
    setSavedNoteId(null);
    setEditing(true);
    setForm({
      ...emptyForm(),
      appointmentId: consultation?.appointmentId ?? "",
    });
    loadLatestPlan();
  }

  function loadNoteIntoForm(n: SessionNoteView) {
    setSavedNoteId(n.id);
    setEditing(true);
    setForm({
      appointmentId: n.appointmentId ?? "",
      notasEvolucion: n.notasEvolucion ?? "",
      tratamiento: n.tratamiento ?? "",
      observaciones: n.observaciones ?? "",
      rangoMovimiento: n.rangoMovimiento ?? "",
      dolorEva: n.dolorEva != null ? String(n.dolorEva) : "",
    });
  }

  const fieldsLocked = Boolean(savedNoteId) && !editing;
  const isNewNote = !savedNoteId;
  const canShowStartConsultation =
    canStartConsultation &&
    Boolean(consultation) &&
    consultation?.estado !== "en_consulta";
  const canShowFinalize =
    canFinalizeConsultation &&
    consultation?.estado === "en_consulta" &&
    Boolean(savedNoteId);

  function startConsultation() {
    if (!consultation) return;
    startTransition(async () => {
      const res = await updateQueueEstadoAction({
        queueId: consultation.queueId,
        expectedVersion: consultation.version,
        nuevoEstado: "en_consulta",
      });
      toast.fromActionResult(res, "Consulta iniciada");
      if (res.ok) {
        setConsultation({
          ...consultation,
          estado: "en_consulta",
          version: consultation.version + 1,
        });
        router.refresh();
      }
    });
  }

  const canSaveAndFinalize =
    canFinalizeConsultation && Boolean(consultation) && !readOnly;

  async function ensureInConsulta(
    current: ActiveConsultation,
  ): Promise<ActiveConsultation | null> {
    if (current.estado === "en_consulta") return current;
    if (!canStartConsultation) {
      toast.error(
        "No se puede finalizar",
        "La consulta debe estar iniciada por el fisioterapeuta",
      );
      return null;
    }
    const res = await updateQueueEstadoAction({
      queueId: current.queueId,
      expectedVersion: current.version,
      nuevoEstado: "en_consulta",
    });
    if (!res.ok) {
      toast.error("No se pudo iniciar la consulta", res.error);
      return null;
    }
    const next: ActiveConsultation = {
      ...current,
      estado: "en_consulta",
      version: current.version + 1,
    };
    setConsultation(next);
    return next;
  }

  async function persistSeguimiento(appointmentIdOverride?: string) {
    const appointmentId =
      appointmentIdOverride || form.appointmentId || consultation?.appointmentId || "";
    const planPayload = {
      diagnostico: planForm.diagnostico,
      objetivo: planForm.objetivo,
      frecuencia: planForm.frecuencia,
      duracionEstimadaSemanas: planForm.semanas ? Number(planForm.semanas) : undefined,
      ejerciciosDetalle: planForm.ejerciciosDetalle,
    };
    const payload = {
      patientId,
      clinicalId,
      appointmentId,
      notasEvolucion: form.notasEvolucion,
      tratamiento: form.tratamiento,
      observaciones: form.observaciones,
      rangoMovimiento: form.rangoMovimiento,
      dolorEva: form.dolorEva,
      ...(isNewNote ? planPayload : {}),
    };
    const res = savedNoteId
      ? await updateSessionNoteAction({ ...payload, noteId: savedNoteId })
      : await createSessionNoteAction(payload);
    return res;
  }

  return (
    <div className="space-y-6">
      {!readOnly ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (fieldsLocked) return;
            const finalizeAfter = canSaveAndFinalize;
            startTransition(async () => {
              let consult = consultation;
              if (finalizeAfter && consult) {
                consult = await ensureInConsulta(consult);
                if (!consult) return;
              }

              const apptId = form.appointmentId || consult?.appointmentId || "";
              if (apptId && apptId !== form.appointmentId) {
                setForm((prev) => ({ ...prev, appointmentId: apptId }));
              }

              const res = await persistSeguimiento(apptId);
              toast.fromActionResult(
                res,
                savedNoteId ? "Seguimiento actualizado" : "Seguimiento guardado",
              );
              if (!res.ok) return;

              setSavedNoteId(res.id);
              setEditing(false);
              load();

              if (finalizeAfter && consult?.estado === "en_consulta") {
                setShowFinalize(true);
              }
            });
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">
                {savedNoteId
                  ? editing
                    ? "Editar seguimiento"
                    : "Seguimiento guardado"
                  : "Nuevo seguimiento"}
              </h3>
              <p className="text-muted text-xs">
                {fieldsLocked
                  ? "Puede editar los campos o finalizar la consulta."
                  : isNewNote
                    ? "Registre la sesión. El plan de tratamiento es opcional."
                    : "Actualice evolución, tratamiento y observaciones."}
              </p>
            </div>
            {savedNoteId ? (
              <button
                type="button"
                onClick={beginNew}
                className="text-brand text-sm font-medium underline-offset-2 hover:underline"
              >
                Nuevo seguimiento
              </button>
            ) : null}
          </div>

          <label className="block text-sm">
            <span className="text-muted mb-1 block">Atención (cita)</span>
            <select
              name="appointmentId"
              disabled={fieldsLocked}
              value={form.appointmentId}
              onChange={(e) => setField("appointmentId", e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
            >
              <option value="">Sin cita asociada</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted mb-1 block">Seguimiento / evolución</span>
            <AutoTextarea
              name="notasEvolucion"
              minRows={2}
              disabled={fieldsLocked}
              value={form.notasEvolucion}
              onChange={(e) => setField("notasEvolucion", e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted mb-1 block">Tratamiento</span>
            <AutoTextarea
              name="tratamiento"
              minRows={2}
              disabled={fieldsLocked}
              value={form.tratamiento}
              onChange={(e) => setField("tratamiento", e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted mb-1 block">Observaciones</span>
            <AutoTextarea
              name="observaciones"
              minRows={2}
              disabled={fieldsLocked}
              value={form.observaciones}
              onChange={(e) => setField("observaciones", e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Dolor EVA (0–10)</span>
              <input
                name="dolorEva"
                type="number"
                min={0}
                max={10}
                disabled={fieldsLocked}
                value={form.dolorEva}
                onChange={(e) => setField("dolorEva", e.target.value)}
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Rango de movimiento</span>
              <AutoTextarea
                name="rangoMovimiento"
                minRows={2}
                disabled={fieldsLocked}
                value={form.rangoMovimiento}
                onChange={(e) => setField("rangoMovimiento", e.target.value)}
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 disabled:opacity-70"
              />
            </label>
          </div>

          {isNewNote ? (
            <TreatmentPlanFields
              value={planForm}
              onChange={setPlanForm}
              disabled={fieldsLocked}
              required={false}
            />
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!fieldsLocked ? (
              <button
                type="submit"
                disabled={pending}
                className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                {pending
                  ? "Guardando…"
                  : canSaveAndFinalize
                    ? "Guardar y finalizar consulta"
                    : savedNoteId
                      ? "Actualizar seguimiento"
                      : "Guardar seguimiento"}
              </button>
            ) : null}

            {!fieldsLocked && canSaveAndFinalize ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await persistSeguimiento();
                    toast.fromActionResult(res, "Seguimiento guardado");
                    if (res.ok) {
                      setSavedNoteId(res.id);
                      setEditing(false);
                      load();
                    }
                  });
                }}
                className="border-brand/30 text-brand w-full rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
              >
                Solo guardar
              </button>
            ) : null}

            {fieldsLocked ? (
              <button
                type="button"
                disabled={pending}
                onClick={beginEdit}
                className="border-brand/30 text-brand w-full rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
              >
                Editar
              </button>
            ) : null}

            {fieldsLocked && canShowFinalize ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowFinalize(true)}
                className="bg-accent w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                Finalizar consulta
              </button>
            ) : null}

            {canShowStartConsultation && !canSaveAndFinalize ? (
              <button
                type="button"
                disabled={pending}
                onClick={startConsultation}
                className="border-brand/30 text-brand w-full rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
              >
                Iniciar consulta
              </button>
            ) : null}
          </div>

          {canSaveAndFinalize ? (
            <p className="text-muted text-xs">
              “Guardar y finalizar consulta” guarda el seguimiento, inicia la atención si
              hace falta y abre el envío a cobro para recepción.
            </p>
          ) : null}

          {canFinalizeConsultation && !consultation ? (
            <p className="text-muted text-xs">
              No hay turno activo en cola para este paciente hoy. El seguimiento se puede
              guardar; la finalización estará disponible cuando exista turno.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="text-muted text-sm">
          Historial clínico registrado por el fisioterapeuta (solo consulta).
        </p>
      )}

      <div className={`space-y-3 ${readOnly ? "" : "border-brand/10 border-t pt-4"}`}>
        <h3 className="font-semibold">Historial de evolución</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-muted mb-1 block text-xs">Atención</span>
            <select
              value={atencion}
              onChange={(e) => setAtencion(e.target.value)}
              className="border-brand/20 bg-background w-full rounded-md border px-2 py-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="none">Sin cita</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending}
              onClick={load}
              className="bg-brand w-full rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Filtrar
            </button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <ul className="space-y-3">
          {notes.length === 0 ? (
            <li className="text-muted text-sm">Sin seguimientos en este filtro.</li>
          ) : (
            notes.map((n) => (
              <li
                key={n.id}
                className="border-brand/15 rounded-md border px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{formatInClinicTz(n.createdAt, timezone)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-muted text-xs">
                      {n.dolorEva != null ? `EVA ${n.dolorEva}/10` : "Sin EVA"}
                      {n.appointmentId
                        ? ` · ${appointments.find((a) => a.id === n.appointmentId)?.label ?? "Cita"}`
                        : " · Sin cita"}
                    </p>
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() => loadNoteIntoForm(n)}
                        className="text-brand text-xs font-medium underline-offset-2 hover:underline"
                      >
                        Editar
                      </button>
                    ) : null}
                  </div>
                </div>
                {n.notasEvolucion ? (
                  <p className="mt-2">
                    <span className="text-muted">Evolución: </span>
                    {n.notasEvolucion}
                  </p>
                ) : null}
                {n.tratamiento ? (
                  <p className="mt-1">
                    <span className="text-muted">Tratamiento: </span>
                    {n.tratamiento}
                  </p>
                ) : null}
                {n.observaciones ? (
                  <p className="mt-1">
                    <span className="text-muted">Observaciones: </span>
                    {n.observaciones}
                  </p>
                ) : null}
                {n.rangoMovimiento ? (
                  <p className="mt-1">
                    <span className="text-muted">ROM: </span>
                    {n.rangoMovimiento}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>

      {showFinalize && consultation ? (
        <FinalizeServicesModal
          appointmentId={consultation.appointmentId}
          queueId={consultation.queueId}
          expectedVersion={consultation.version}
          patientNombre={consultation.patientNombre}
          services={services}
          onClose={() => setShowFinalize(false)}
          onDone={() => {
            setShowFinalize(false);
            setConsultation(null);
            toast.success("Consulta finalizada", "Enviada a cobro. Volviendo a la cola…");
            router.push("/app/cola");
          }}
        />
      ) : null}
    </div>
  );
}
