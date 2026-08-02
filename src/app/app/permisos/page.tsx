import { redirect } from "next/navigation";

import { PermissionsManager } from "@/components/permissions/PermissionsManager";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { requireMenuAccess } from "@/lib/permissions/require";

export const metadata = { title: "Permisos — Terafis" };

export default async function PermisosPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  await requireMenuAccess(staff, "permisos");
  if (staff.rol !== "admin") {
    return (
      <main className="space-y-2">
        <h1 className="font-serif text-3xl">Permisos</h1>
        <p className="text-muted text-sm">
          Solo el administrador puede gestionar el acceso al menú.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Permisos de menú</h1>
        <p className="text-muted mt-1 text-sm">
          Defina qué opciones ve cada rol y excepciones por usuario. El bloqueo también
          aplica al abrir la ruta directamente.
        </p>
      </div>
      <PermissionsManager currentStaffId={staff.id} />
    </main>
  );
}
