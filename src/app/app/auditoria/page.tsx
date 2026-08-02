import { redirect } from "next/navigation";

import { AuditClient } from "@/components/audit/AuditClient";
import { listAuditLogsAction } from "@/lib/audit/actions";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { requireMenuAccess } from "@/lib/permissions/require";
import { RoleCapabilities } from "@/lib/roles";

export const metadata = {
  title: "Auditoría",
};

export default async function AuditoriaPage() {
  const staff = await getCurrentStaff();
  if (!staff || !RoleCapabilities[staff.rol].verAuditLog) {
    redirect("/app?error=forbidden");
  }
  await requireMenuAccess(staff, "auditoria");

  const initial = await listAuditLogsAction({ limit: 100, resultado: "todos" });
  if (!initial.ok) {
    return (
      <main>
        <h1 className="font-serif text-3xl">Auditoría</h1>
        <p className="mt-4 text-sm text-red-700">{initial.error}</p>
        <p className="text-muted mt-2 text-sm">
          Si acaba de desplegar, aplique la migración{" "}
          <code>20260730230000_audit_resultado.sql</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Auditoría</h1>
        <p className="text-muted mt-1 text-sm">
          Bitácora append-only de acciones del sistema: usuario, acción, fecha y resultado
          (éxito / error).
        </p>
      </div>
      <AuditClient initialRows={initial.rows} actors={initial.actors} />
    </main>
  );
}
