"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ActionButton } from "@/components/ui/ActionButton";

export type PatientListRow = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  expedientes?: number;
  seguimientos?: number;
};

type Props = {
  patients: PatientListRow[];
  canAddToAttend: boolean;
  canViewClinical?: boolean;
};

export function PatientsSearchList({
  patients,
  canAddToAttend,
  canViewClinical = false,
}: Props) {
  const [q, setQ] = useState("");
  const [soloConExpediente, setSoloConExpediente] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return patients.filter((p) => {
      if (soloConExpediente && !(p.expedientes && p.expedientes > 0)) {
        return false;
      }
      if (!term) return true;
      return (
        p.nombre.toLowerCase().includes(term) ||
        p.telefono.toLowerCase().includes(term) ||
        (p.email?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [patients, q, soloConExpediente]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block flex-1 text-sm sm:min-w-[240px]">
          <span className="text-muted mb-1 block">Buscar paciente</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, teléfono o correo"
            className="border-brand/20 bg-background w-full max-w-md rounded-md border px-3 py-2"
          />
        </label>
        {canViewClinical ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soloConExpediente}
              onChange={(e) => setSoloConExpediente(e.target.checked)}
              className="accent-brand"
            />
            Solo con expediente
          </label>
        ) : null}
      </div>

      <div className="border-brand/15 bg-surface overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-brand/10 text-muted border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              {canViewClinical ? (
                <th className="px-4 py-3 font-medium">Clínico</th>
              ) : null}
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canViewClinical ? 5 : 4}
                  className="text-muted px-4 py-8 text-center"
                >
                  {patients.length === 0
                    ? "Aún no hay pacientes registrados."
                    : "Ningún paciente coincide con la búsqueda."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const hasClinical = (p.expedientes ?? 0) > 0;
                return (
                  <tr
                    key={p.id}
                    className="border-brand/5 border-b last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{p.nombre}</td>
                    <td className="px-4 py-3">{p.telefono}</td>
                    <td className="px-4 py-3">{p.email ?? "—"}</td>
                    {canViewClinical ? (
                      <td className="px-4 py-3 text-xs">
                        {hasClinical ? (
                          <span>
                            {p.expedientes} exp. · {p.seguimientos ?? 0} seg.
                          </span>
                        ) : (
                          <span className="text-muted">Sin expediente</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
                        <ActionButton
                          href={`/app/pacientes/${p.id}`}
                          variant="secondary"
                          inline
                        >
                          Ver ficha
                        </ActionButton>
                        {canViewClinical && hasClinical ? (
                          <ActionButton
                            href={`/app/pacientes/${p.id}#expedientes`}
                            variant="secondary"
                            inline
                          >
                            Ver expediente
                          </ActionButton>
                        ) : null}
                        {canAddToAttend ? (
                          <Link
                            href={`/app/cola?patientId=${p.id}`}
                            className="border-brand/30 text-brand inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium sm:w-auto"
                          >
                            A cola
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
