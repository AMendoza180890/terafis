import { headers } from "next/headers";

import { computeAuditHash, genesisHash } from "@/lib/audit/hash-chain";
import type { CurrentStaff } from "@/lib/auth/current-staff";
import { createClient } from "@/lib/supabase/server";

export type AuditResultado = "exito" | "error" | "info";

type WriteAuditInput = {
  staff: CurrentStaff;
  accion: string;
  tabla?: string;
  registroId?: string;
  diff?: Record<string, unknown> | null;
  /** Por defecto: exito */
  resultado?: AuditResultado;
  /** Mensaje legible (error o resumen); sin datos clínicos en claro */
  mensaje?: string | null;
};

/**
 * Inserta una fila en audit_log con cadena de hash.
 * Nunca incluir contenido clínico en claro en `diff` ni `mensaje`.
 */
export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  const supabase = await createClient();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");
  const resultado = input.resultado ?? "exito";
  const mensaje = input.mensaje ?? null;

  const { data: last } = await supabase
    .from("audit_log")
    .select("hash_actual")
    .eq("clinic_id", input.staff.clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hashAnterior =
    (last as { hash_actual?: string } | null)?.hash_actual ?? genesisHash();
  const createdAt = new Date().toISOString();

  const hashActual = computeAuditHash(
    {
      clinicId: input.staff.clinicId,
      actorId: input.staff.id,
      rol: input.staff.rol,
      accion: input.accion,
      tabla: input.tabla ?? null,
      registroId: input.registroId ?? null,
      ip,
      userAgent,
      diff: input.diff ?? null,
      createdAt,
    },
    hashAnterior,
  );

  const { error } = await supabase.from("audit_log").insert({
    clinic_id: input.staff.clinicId,
    actor_id: input.staff.id,
    rol: input.staff.rol,
    accion: input.accion,
    tabla: input.tabla ?? null,
    registro_id: input.registroId ?? null,
    ip,
    user_agent: userAgent,
    diff: input.diff ?? null,
    resultado,
    mensaje,
    hash_anterior: hashAnterior,
    hash_actual: hashActual,
    created_at: createdAt,
  });

  if (error) {
    console.error("No se pudo escribir audit_log:", error.message);
  }
}

/** Atajo para registrar un fallo de acción (validación, BD, autorización). */
export async function writeAuditError(input: {
  staff: CurrentStaff;
  accion: string;
  mensaje: string;
  tabla?: string;
  registroId?: string;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  await writeAuditLog({
    ...input,
    resultado: "error",
    mensaje: input.mensaje.slice(0, 500),
  });
}
