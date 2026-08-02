import { ReportsClient } from "@/components/reports/ReportsClient";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { requireMenuAccess } from "@/lib/permissions/require";
import { canExportPatientData } from "@/lib/reports/export";

export const metadata = { title: "Reportes — Terafis" };

export default async function ReportesPage() {
  const staff = await getCurrentStaff();
  await requireMenuAccess(staff, "reportes");

  if (staff?.rol === "terapeuta") {
    return (
      <main>
        <h1 className="font-serif text-3xl">Reportes</h1>
        <p className="text-muted mt-3">
          El rol terapeuta no tiene acceso a reportes financieros agregados.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Reportes y estadísticas</h1>
        <p className="text-muted mt-1 text-sm">
          Agregados disociados. Exportaciones con PII solo admin + audit_log.
        </p>
      </div>
      <ReportsClient canExport={staff ? canExportPatientData(staff.rol) : false} />
    </main>
  );
}
