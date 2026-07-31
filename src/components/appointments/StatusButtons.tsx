"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateAppointmentStatusAction } from "@/lib/appointments/actions";
import type { AppointmentStatus } from "@/lib/appointments/schemas";

const NEXT: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  pendiente: "confirmada",
  confirmada: "en_sala_espera",
  en_sala_espera: "en_consulta",
  en_consulta: "completado",
};

export function StatusButtons({
  appointmentId,
  estado,
}: {
  appointmentId: string;
  estado: AppointmentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = NEXT[estado];

  function change(to: AppointmentStatus) {
    startTransition(async () => {
      await updateAppointmentStatusAction({ appointmentId, estado: to });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {next ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => change(next)}
          className="bg-brand w-full rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50 sm:w-auto"
        >
          → {next}
        </button>
      ) : null}
      {estado !== "cancelado" && estado !== "completado" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => change("cancelado")}
          className="w-full rounded border border-red-300 px-2 py-1 text-xs text-red-700 sm:w-auto"
        >
          Cancelar
        </button>
      ) : null}
    </div>
  );
}
