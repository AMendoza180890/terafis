import { ServicesManager } from "@/components/services/ServicesManager";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Servicios — Terafis" };

export default async function ServiciosPage() {
  const staff = await getCurrentStaff();
  let services: Array<{
    id: string;
    tipo: string;
    titulo: string;
    descripcion: string | null;
    costo: string;
    duracion_minutos: number | null;
    requiere_autorizacion: boolean;
    activo: boolean;
  }> = [];

  if (staff) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("services")
      .select(
        "id, tipo, titulo, descripcion, costo, duracion_minutos, requiere_autorizacion, activo",
      )
      .order("titulo");
    services = (
      (data ?? []) as Array<{
        id: string;
        tipo: string;
        titulo: string;
        descripcion: string | null;
        costo: string | number;
        duracion_minutos: number | null;
        requiere_autorizacion: boolean;
        activo: boolean;
      }>
    ).map((s) => ({ ...s, costo: String(s.costo) }));
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Catálogo de servicios</h1>
        <p className="text-muted mt-1 text-sm">
          Precios de lista en córdobas (C$). Al aplicarlos en consulta se congela
          `costo_aplicado`.
        </p>
      </div>
      <ServicesManager services={services} isAdmin={staff?.rol === "admin"} />
    </main>
  );
}
