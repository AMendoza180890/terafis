"use server";

import { z } from "zod";

import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { clinicDayBoundsUtc, DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { hasMenuAccess } from "@/lib/permissions/require";
import { RoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

const AuditFilterSchema = z.object({
  actorId: z.string().uuid().optional().or(z.literal("")),
  accion: z.string().max(120).optional(),
  resultado: z.enum(["exito", "error", "info", "todos"]).default("todos"),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_nombre: string | null;
  rol: string | null;
  accion: string;
  tabla: string | null;
  registro_id: string | null;
  resultado: "exito" | "error" | "info";
  mensaje: string | null;
  ip: string | null;
  created_at: string;
  diff: Record<string, unknown> | null;
};

export type ListAuditResult =
  | { ok: true; rows: AuditLogRow[]; actors: Array<{ id: string; nombre: string }> }
  | { ok: false; error: string };

export async function listAuditLogsAction(raw: unknown): Promise<ListAuditResult> {
  const parsed = AuditFilterSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtros inválidos" };
  }

  const staff = await requireCurrentStaff();
  if (!RoleCapabilities[staff.rol].verAuditLog) {
    return { ok: false, error: "No tiene permiso para ver la auditoría." };
  }
  if (!(await hasMenuAccess(staff, "auditoria"))) {
    return { ok: false, error: "No tiene permiso para ver la auditoría." };
  }

  const supabase = await createClient();
  const f = parsed.data;

  let timezone = DEFAULT_TZ;
  if (f.desde || f.hasta) {
    const { data: cfg } = await supabase
      .from("clinic_config")
      .select("timezone")
      .eq("clinic_id", staff.clinicId)
      .maybeSingle();
    timezone = (cfg as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
  }

  let query = supabase
    .from("audit_log")
    .select(
      "id, actor_id, rol, accion, tabla, registro_id, resultado, mensaje, ip, created_at, diff",
    )
    .eq("clinic_id", staff.clinicId)
    .order("created_at", { ascending: false })
    .limit(f.limit);

  if (f.actorId) query = query.eq("actor_id", f.actorId);
  if (f.accion?.trim()) query = query.ilike("accion", `%${f.accion.trim()}%`);
  if (f.resultado !== "todos") query = query.eq("resultado", f.resultado);
  if (f.desde)
    query = query.gte("created_at", clinicDayBoundsUtc(f.desde, timezone).startIso);
  if (f.hasta)
    query = query.lt("created_at", clinicDayBoundsUtc(f.hasta, timezone).endIso);
  if (f.q?.trim()) {
    const term = f.q.trim();
    query = query.or(
      `accion.ilike.%${term}%,mensaje.ilike.%${term}%,tabla.ilike.%${term}%`,
    );
  }

  const [{ data, error }, { data: staffRows }] = await Promise.all([
    query,
    supabase
      .from("staff")
      .select("id, nombre")
      .eq("clinic_id", staff.clinicId)
      .order("nombre"),
  ]);

  if (error) {
    // Compatibilidad si aún no se aplicó la migración de resultado/mensaje
    if (error.message.includes("resultado") || error.message.includes("mensaje")) {
      return {
        ok: false,
        error:
          "Falta aplicar la migración 20260730230000_audit_resultado.sql en Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  const nameById = new Map(
    ((staffRows ?? []) as Array<{ id: string; nombre: string }>).map((s) => [
      s.id,
      s.nombre,
    ]),
  );

  const rows: AuditLogRow[] = (
    (data ?? []) as Array<Omit<AuditLogRow, "actor_nombre">>
  ).map((row) => ({
    ...row,
    resultado: (row.resultado as AuditLogRow["resultado"]) ?? "exito",
    actor_nombre: row.actor_id ? (nameById.get(row.actor_id) ?? null) : null,
  }));

  return {
    ok: true,
    rows,
    actors: (staffRows ?? []) as Array<{ id: string; nombre: string }>,
  };
}
