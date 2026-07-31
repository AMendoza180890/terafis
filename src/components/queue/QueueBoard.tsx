"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { ChargeModal } from "@/components/queue/ChargeModal";
import { FinalizeServicesModal } from "@/components/queue/FinalizeServicesModal";
import { useQueueRealtime } from "@/hooks/useQueueRealtime";
import { formatCordobas } from "@/lib/money/format";
import {
  reorderQueueAction,
  syncDailyQueueAction,
  updateQueueEstadoAction,
} from "@/lib/queue/actions";
import { QUEUE_COLUMNS, type QueueStatus } from "@/lib/queue/schemas";
import type { QueueItemView } from "@/lib/queue/types";

function formatHora(isoOrTime: string | null | undefined) {
  if (!isoOrTime) return null;
  if (isoOrTime.includes("T")) {
    try {
      return new Date(isoOrTime).toLocaleTimeString("es-NI", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }
  return String(isoOrTime).slice(0, 5);
}

function statusHint(estado: QueueStatus): string | null {
  switch (estado) {
    case "en_consulta":
      return "En atención";
    case "pendiente_pago":
      return "Listo para cobro";
    case "completado":
      return "Consulta finalizada y pagada";
    default:
      return null;
  }
}

type ServiceOpt = { id: string; titulo: string; costo: string };

type Props = {
  clinicId: string | null;
  fecha: string;
  items: QueueItemView[];
  services: ServiceOpt[];
  canCharge: boolean;
  canFinalize: boolean;
  canSync: boolean;
  /** Recepción/admin: check-in, reordenar, cobrar, no asistió. */
  canManage: boolean;
  /** Fisio/admin: iniciar y finalizar consulta en turnos propios. */
  canAttend: boolean;
  currentStaffId: string | null;
};

export function QueueBoard({
  clinicId,
  fecha,
  items,
  services,
  canCharge,
  canFinalize,
  canSync,
  canManage,
  canAttend,
  currentStaffId,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [chargeItem, setChargeItem] = useState<QueueItemView | null>(null);
  const [finalizeItem, setFinalizeItem] = useState<QueueItemView | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useQueueRealtime(clinicId);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(
      QUEUE_COLUMNS.map((c) => [c.estado, [] as QueueItemView[]]),
    ) as Record<QueueStatus, QueueItemView[]>;
    for (const item of items) {
      if (map[item.estado]) map[item.estado].push(item);
    }
    for (const col of QUEUE_COLUMNS) {
      map[col.estado].sort((a, b) => a.posicionCola - b.posicionCola);
    }
    return map;
  }, [items]);

  function refreshMsg(text: string) {
    setMessage(text);
    toast.success(text);
    router.refresh();
  }

  function isOwnTurn(item: QueueItemView) {
    return Boolean(currentStaffId && item.terapeutaId === currentStaffId);
  }

  function canStartOwn(item: QueueItemView) {
    if (item.estado !== "pendiente" && item.estado !== "en_sala_espera") {
      return false;
    }
    if (canManage) return true;
    return canAttend && isOwnTurn(item);
  }

  function canFinalizeOwn(item: QueueItemView) {
    if (!canFinalize || item.estado !== "en_consulta") return false;
    if (canManage) return true;
    return isOwnTurn(item);
  }

  function transition(item: QueueItemView, to: QueueStatus) {
    const startingOwn = to === "en_consulta" && canStartOwn(item);
    if (!canManage && !startingOwn) return;
    startTransition(async () => {
      const result = await updateQueueEstadoAction({
        queueId: item.id,
        expectedVersion: item.version,
        nuevoEstado: to,
      });
      if (!result.ok) {
        setMessage(result.error);
        toast.error("Error en cola", result.error);
        if (result.conflict) router.refresh();
        return;
      }
      if (to === "en_consulta") {
        toast.success("Consulta iniciada", "Abriendo seguimiento…");
        // Fisio (turno propio): ir a la ficha para registrar seguimiento.
        if (canAttend && isOwnTurn(item)) {
          router.push(`/app/pacientes/${item.patientId}`);
          return;
        }
      }
      refreshMsg(to === "en_consulta" ? "Consulta iniciada" : `Estado → ${to}`);
    });
  }

  function onDropReorder(targetId: string) {
    if (!canManage) return;
    if (!dragId || dragId === targetId) return;
    const waiting = byColumn.en_sala_espera.map((i) => i.id);
    const from = waiting.indexOf(dragId);
    const to = waiting.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...waiting];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    startTransition(async () => {
      const result = await reorderQueueAction({ fecha, orderedIds: next });
      toast.fromActionResult(result, "Cola reordenada");
      setMessage(result.ok ? "Cola reordenada" : result.error);
      router.refresh();
    });
    setDragId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-muted text-sm">
          Fecha {fecha}
          {canManage
            ? " · optimistic locking · tiempo real"
            : canAttend
              ? " · puede iniciar y finalizar sus consultas"
              : " · solo lectura"}
        </p>
        {canSync && canManage ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await syncDailyQueueAction(fecha);
                const msg = result.ok
                  ? `Sincronizados ${result.count ?? 0} turnos`
                  : result.error;
                toast.fromActionResult(
                  result,
                  "Cola sincronizada",
                  result.ok ? msg : undefined,
                );
                setMessage(msg);
                router.refresh();
              })
            }
            className="bg-brand w-full rounded-md px-3 py-2 text-sm font-semibold text-white sm:w-auto"
          >
            Sincronizar citas del día
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="bg-brand-soft/60 rounded-md px-3 py-2 text-sm" role="status">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {QUEUE_COLUMNS.map((col) => (
          <section
            key={col.estado}
            className={`bg-surface rounded-xl border-t-4 p-3 shadow-sm ${col.tone}`}
          >
            <h2 className="text-sm font-semibold">
              {col.title}{" "}
              <span className="text-muted">({byColumn[col.estado].length})</span>
            </h2>
            <ul className="mt-3 space-y-2">
              {byColumn[col.estado].length === 0 ? (
                <li className="text-muted text-xs">Vacío</li>
              ) : (
                byColumn[col.estado].map((item) => (
                  <li
                    key={item.id}
                    draggable={canManage && col.estado === "en_sala_espera"}
                    onDragStart={() => {
                      if (canManage) setDragId(item.id);
                    }}
                    onDragOver={(e) => {
                      if (canManage) e.preventDefault();
                    }}
                    onDrop={() => onDropReorder(item.id)}
                    className={[
                      "border-brand/10 bg-background rounded-lg border p-3 text-sm",
                      col.estado === "en_consulta" ? "ring-accent/30 ring-1" : "",
                      col.estado === "pendiente_pago"
                        ? "ring-celeste/40 border-celeste/40 ring-1"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <Link
                        href={`/app/pacientes/${item.patientId}`}
                        className="text-brand font-medium hover:underline"
                      >
                        {item.patientNombre}
                      </Link>
                      {statusHint(col.estado) ? (
                        <span className="bg-brand-soft text-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {statusHint(col.estado)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted mt-1 text-xs">
                      Fisio: {item.terapeutaNombre}
                    </p>
                    <p className="text-muted text-xs">
                      Cita {formatHora(item.horaCita) ?? "—"}
                      {item.tipoServicio ? ` · ${item.tipoServicio}` : ""}
                    </p>
                    {item.patientTelefono ? (
                      <p className="text-muted text-xs">
                        Tel. {item.patientTelefono}
                      </p>
                    ) : null}
                    {col.estado === "en_consulta" && item.horaInicioAtencion ? (
                      <p className="text-accent mt-1 text-xs font-medium">
                        Inició {formatHora(item.horaInicioAtencion)}
                      </p>
                    ) : null}
                    {col.estado === "pendiente_pago" ? (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                          Requiere pago en caja
                        </p>
                        {item.horaFinAtencion ? (
                          <p className="text-muted text-xs">
                            Finalizó {formatHora(item.horaFinAtencion)}
                          </p>
                        ) : null}
                        {item.serviciosResumen.length > 0 ? (
                          <p className="text-muted text-xs">
                            {item.serviciosResumen.join(", ")}
                          </p>
                        ) : null}
                        {item.totalPendiente ? (
                          <p className="text-brand text-xs font-semibold">
                            Cobrar {formatCordobas(item.totalPendiente)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {col.estado === "completado" ? (
                      <div className="mt-1 space-y-0.5">
                        {item.horaFinAtencion ? (
                          <p className="text-muted text-xs">
                            Cerrado {formatHora(item.horaFinAtencion)}
                          </p>
                        ) : null}
                        {item.serviciosResumen.length > 0 ? (
                          <p className="text-muted text-xs">
                            {item.serviciosResumen.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {item.notasRecepcion &&
                    (col.estado === "en_consulta" ||
                      col.estado === "pendiente_pago") ? (
                      <p className="text-muted mt-1 line-clamp-2 text-xs">
                        Nota: {item.notasRecepcion}
                      </p>
                    ) : null}
                    {canManage || canStartOwn(item) || canFinalizeOwn(item) ? (
                      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                        {canManage && col.estado === "pendiente" ? (
                          <Action
                            label="Check-in"
                            onClick={() => transition(item, "en_sala_espera")}
                          />
                        ) : null}
                        {canStartOwn(item) ? (
                          <Action
                            label="Iniciar consulta"
                            onClick={() => transition(item, "en_consulta")}
                          />
                        ) : null}
                        {canAttend &&
                        isOwnTurn(item) &&
                        col.estado === "en_consulta" ? (
                          <Action
                            label="Retornar a atención"
                            onClick={() =>
                              router.push(`/app/pacientes/${item.patientId}`)
                            }
                          />
                        ) : null}
                        {canFinalizeOwn(item) ? (
                          <Action
                            label="Finalizar"
                            onClick={() => setFinalizeItem(item)}
                          />
                        ) : null}
                        {canManage &&
                        col.estado === "pendiente_pago" &&
                        canCharge ? (
                          <Action
                            label="Cobrar"
                            onClick={() => setChargeItem(item)}
                          />
                        ) : null}
                        {canManage &&
                        col.estado !== "completado" &&
                        col.estado !== "cancelado" &&
                        col.estado !== "no_asistio" ? (
                          <Action
                            label="No asistió"
                            tone="danger"
                            onClick={() => transition(item, "no_asistio")}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>

      {chargeItem ? (
        <ChargeModal
          appointmentId={chargeItem.appointmentId}
          queueId={chargeItem.id}
          expectedVersion={chargeItem.version}
          patientNombre={chargeItem.patientNombre}
          onClose={() => setChargeItem(null)}
          onPaid={() => {
            setChargeItem(null);
            refreshMsg("Pago registrado");
          }}
        />
      ) : null}

      {finalizeItem ? (
        <FinalizeServicesModal
          appointmentId={finalizeItem.appointmentId}
          queueId={finalizeItem.id}
          expectedVersion={finalizeItem.version}
          patientNombre={finalizeItem.patientNombre}
          services={services}
          onClose={() => setFinalizeItem(null)}
          onDone={() => {
            setFinalizeItem(null);
            refreshMsg("Enviado a cobro");
          }}
        />
      ) : null}
    </div>
  );
}

function Action({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === "danger"
          ? "w-full rounded border border-red-300 px-2 py-1 text-xs text-red-700 sm:w-auto sm:py-0.5"
          : "bg-brand w-full rounded px-2 py-1 text-xs font-medium text-white sm:w-auto sm:py-0.5"
      }
    >
      {label}
    </button>
  );
}
