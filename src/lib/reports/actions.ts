"use server";

import { writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import { fromCents } from "@/lib/money/cents";
import { formatMoney } from "@/lib/money/totals";
import {
  absenteeismRate,
  assertAggregatesAreDissociated,
  cashCutByCashier,
  revenueByMethod,
  revenueCents,
  sessionsByTherapist,
} from "@/lib/reports/aggregates";
import {
  canExportPatientData,
  toCsv,
  toExcelXml,
  toSimplePdf,
} from "@/lib/reports/export";
import { createClient } from "@/lib/supabase/server";

export type ReportsSummary = {
  pacientesNuevos: number;
  ingresosCents: number;
  ingresosLabel: string;
  porMetodo: Array<{ metodo: string; total: string }>;
  ausentismo: { noAsistio: number; total: number; rate: number };
  sesionesPorTerapeuta: Array<{ terapeutaId: string; sesiones: number }>;
  corteCaja: Array<{ cajeroId: string; total: string; count: number }>;
};

export async function getReportsSummaryAction(input: {
  from: string;
  to: string;
}): Promise<{ ok: true; data: ReportsSummary } | { ok: false; error: string }> {
  const staff = await requireCurrentStaff();
  if (staff.rol === "terapeuta") {
    return { ok: false, error: "Sin acceso a reportes financieros" };
  }

  const from = new Date(input.from);
  const to = new Date(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "Rango de fechas inválido" };
  }

  const supabase = await createClient();

  const [
    { count: nuevos },
    { data: payments },
    { data: appointments },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("monto, metodo_pago, estado, cajero_id, fecha_pago")
      .gte("fecha_pago", from.toISOString())
      .lt("fecha_pago", to.toISOString()),
    supabase
      .from("appointments")
      .select("estado, terapeuta_id, inicio")
      .gte("inicio", from.toISOString())
      .lt("inicio", to.toISOString()),
  ]);

  const payRows = (payments ?? []) as Array<{
    monto: string | number;
    metodo_pago: string;
    estado: string;
    cajero_id: string | null;
    fecha_pago: string | null;
  }>;
  const apptRows = (appointments ?? []) as Array<{
    estado: string;
    terapeuta_id: string;
    inicio: string;
  }>;

  const ingresos = revenueCents(payRows);
  const byMethod = revenueByMethod(payRows);
  const ausentismo = absenteeismRate(apptRows);
  const sesiones = sessionsByTherapist(apptRows);
  const corte = cashCutByCashier(payRows);

  const data: ReportsSummary = {
    pacientesNuevos: nuevos ?? 0,
    ingresosCents: ingresos,
    ingresosLabel: formatMoney(ingresos),
    porMetodo: Object.entries(byMethod).map(([metodo, cents]) => ({
      metodo,
      total: fromCents(cents),
    })),
    ausentismo,
    sesionesPorTerapeuta: sesiones,
    corteCaja: corte.map((c) => ({
      cajeroId: c.cajeroId,
      total: fromCents(c.totalCents),
      count: c.count,
    })),
  };

  assertAggregatesAreDissociated(data);
  return { ok: true, data };
}

export async function exportPatientsCsvAction(): Promise<
  { ok: true; csv: string; filename: string } | { ok: false; error: string }
> {
  const staff = await requireCurrentStaff();
  if (!canExportPatientData(staff.rol)) {
    return {
      ok: false,
      error: "Solo el administrador puede exportar datos de pacientes",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, nombre, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Array<{
    id: string;
    nombre: string;
    created_at: string;
  }>;

  const csv = toCsv(
    ["id", "nombre", "created_at"],
    rows.map((r) => [r.id, r.nombre, r.created_at]),
  );

  await writeAuditLog({
    staff,
    accion: "export.patients_csv",
    tabla: "patients",
    diff: {
      formato: "csv",
      filas: rows.length,
      // sin contenido clínico / sin dump de PII en el diff
    },
  });

  const filename = `pacientes-${new Date().toISOString().slice(0, 10)}.csv`;
  return { ok: true, csv, filename };
}

export async function exportPatientsExcelAction(): Promise<
  | { ok: true; content: string; filename: string; mime: string }
  | { ok: false; error: string }
> {
  const staff = await requireCurrentStaff();
  if (!canExportPatientData(staff.rol)) {
    return {
      ok: false,
      error: "Solo el administrador puede exportar datos de pacientes",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, nombre, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Array<{
    id: string;
    nombre: string;
    created_at: string;
  }>;

  const content = toExcelXml(
    "Pacientes",
    ["id", "nombre", "created_at"],
    rows.map((r) => [r.id, r.nombre, r.created_at]),
  );

  await writeAuditLog({
    staff,
    accion: "export.patients_excel",
    tabla: "patients",
    diff: { formato: "xls", filas: rows.length },
  });

  return {
    ok: true,
    content,
    filename: `pacientes-${new Date().toISOString().slice(0, 10)}.xls`,
    mime: "application/vnd.ms-excel",
  };
}

export async function exportSummaryAction(input: {
  from: string;
  to: string;
  format: "csv" | "excel" | "pdf";
}): Promise<
  | { ok: true; content: string; filename: string; mime: string; encoding: "utf8" | "base64" }
  | { ok: false; error: string }
> {
  const summary = await getReportsSummaryAction({
    from: input.from,
    to: input.to,
  });
  if (!summary.ok) return summary;

  const staff = await requireCurrentStaff();
  const d = summary.data;
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = ["metrica", "valor"];
  const rows = [
    ["pacientes_nuevos", d.pacientesNuevos],
    ["ingresos", d.ingresosLabel],
    ["ausentismo_tasa", d.ausentismo.rate],
    ["ausentismo_no_asistio", d.ausentismo.noAsistio],
    ["ausentismo_total_citas", d.ausentismo.total],
    ...d.porMetodo.map((m) => [`metodo_${m.metodo}`, m.total] as const),
    ...d.corteCaja.map(
      (c) => [`corte_${c.cajeroId}`, `${c.total} (${c.count})`] as const,
    ),
    ...d.sesionesPorTerapeuta.map(
      (s) => [`sesiones_${s.terapeutaId}`, s.sesiones] as const,
    ),
  ];

  await writeAuditLog({
    staff,
    accion: `export.summary_${input.format}`,
    tabla: "reports",
    diff: {
      formato: input.format,
      from: input.from,
      to: input.to,
      // agregados disociados — sin nombres
    },
  });

  if (input.format === "csv") {
    return {
      ok: true,
      content: toCsv(headers, rows.map((r) => [...r])),
      filename: `reporte-${stamp}.csv`,
      mime: "text/csv;charset=utf-8",
      encoding: "utf8",
    };
  }

  if (input.format === "excel") {
    return {
      ok: true,
      content: toExcelXml("Reporte", headers, rows.map((r) => [...r])),
      filename: `reporte-${stamp}.xls`,
      mime: "application/vnd.ms-excel",
      encoding: "utf8",
    };
  }

  const lines = rows.map(([k, v]) => `${k}: ${v}`);
  const pdf = toSimplePdf(`Terafis reporte ${stamp}`, lines);
  return {
    ok: true,
    content: Buffer.from(pdf).toString("base64"),
    filename: `reporte-${stamp}.pdf`,
    mime: "application/pdf",
    encoding: "base64",
  };
}
