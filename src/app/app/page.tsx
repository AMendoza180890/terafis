import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { clinicTodayIso, DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { formatMoney } from "@/lib/money/totals";
import { revenueCents } from "@/lib/reports/aggregates";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Panel — Terafis",
};

export default async function AppHomePage() {
  const staff = await getCurrentStaff();
  let citasHoy = 0;
  let enEspera = 0;
  let ingresosHoy = "C$ 0.00";
  let alertasStock = 0;

  if (staff) {
    try {
      const supabase = await createClient();
      const { data: cfg } = await supabase
        .from("clinic_config")
        .select("timezone")
        .eq("clinic_id", staff.clinicId)
        .maybeSingle();
      const tz =
        (cfg as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
      const fechaClinica = clinicTodayIso(tz);
      const start = new Date(`${fechaClinica}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [
        { count: apptCount },
        { count: waitCount },
        { data: payments },
        { data: lowStock },
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("inicio", start.toISOString())
          .lt("inicio", end.toISOString())
          .not("estado", "in", "(cancelado,no_asistio)"),
        supabase
          .from("daily_queue")
          .select("id", { count: "exact", head: true })
          .eq("estado", "en_sala_espera")
          .eq("fecha", fechaClinica),
        staff.rol === "terapeuta"
          ? Promise.resolve({
              data: [] as Array<{
                monto: string;
                metodo_pago: string;
                estado: string;
                cajero_id: string | null;
                fecha_pago: string | null;
              }>,
            })
          : supabase
              .from("payments")
              .select("monto, metodo_pago, estado, cajero_id, fecha_pago")
              .eq("estado", "pagado")
              .gte("fecha_pago", start.toISOString()),
        supabase
          .from("product_stock")          .select("product_id")
          .eq("bajo_minimo", true)
          .eq("activo", true),
      ]);

      citasHoy = apptCount ?? 0;
      enEspera = waitCount ?? 0;
      ingresosHoy = formatMoney(
        revenueCents(
          (payments ?? []) as Array<{
            monto: string | number;
            metodo_pago: string;
            estado: string;
            cajero_id: string | null;
            fecha_pago: string | null;
          }>,
        ),
      );
      alertasStock = (lowStock ?? []).length;
    } catch {
      // Sin BD aún
    }
  }

  return (
    <main>
      <h1 className="text-foreground font-serif text-3xl">Panel operativo</h1>
      <p className="text-muted mt-2">
        {staff
          ? `Bienvenido/a, ${staff.nombre}. Rol: ${staff.rol}.`
          : "Configure Supabase y cree un usuario staff para operar con datos reales."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-brand/15 bg-surface rounded-xl border p-5">
          <p className="text-muted text-sm">Citas de hoy</p>
          <p className="text-brand mt-1 text-3xl font-semibold">{citasHoy}</p>
        </div>
        <div className="border-brand/15 bg-surface rounded-xl border p-5">
          <p className="text-muted text-sm">En sala de espera</p>
          <p className="text-brand mt-1 text-3xl font-semibold">{enEspera}</p>
        </div>
        <div className="border-brand/15 bg-surface rounded-xl border p-5">
          <p className="text-muted text-sm">Ingresos del día</p>
          <p className="text-brand mt-1 text-3xl font-semibold">
            {staff?.rol === "terapeuta" ? "—" : ingresosHoy}
          </p>
        </div>
        <div className="border-brand/15 bg-surface rounded-xl border p-5">
          <p className="text-muted text-sm">Alertas de stock</p>
          <p className="text-brand mt-1 text-3xl font-semibold">{alertasStock}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        <ActionButton href="/app/cola">Abrir cola del día</ActionButton>
        <ActionButton href="/app/inventario" className="!bg-accent">
          Inventario
        </ActionButton>
        <ActionButton href="/app/reportes" variant="secondary">
          Reportes
        </ActionButton>
        <ActionButton href="/app/caja" variant="secondary">
          Ver caja
        </ActionButton>
      </div>
    </main>
  );
}
