import { ActionButton } from "@/components/ui/ActionButton";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import {
  clinicDayBoundsUtc,
  clinicTodayIso,
  DEFAULT_TZ,
} from "@/lib/datetime/clinic-tz";
import { formatMoney } from "@/lib/money/totals";
import { getEffectiveMenuAccessForStaff } from "@/lib/permissions/resolve";
import type { MenuKey } from "@/lib/permissions/menu-catalog";
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
  let allowed = new Set<MenuKey>();

  if (staff) {
    try {
      const menuAccess = await getEffectiveMenuAccessForStaff(staff);
      allowed = new Set(menuAccess.effectiveKeys);

      const supabase = await createClient();
      const { data: cfg } = await supabase
        .from("clinic_config")
        .select("timezone")
        .eq("clinic_id", staff.clinicId)
        .maybeSingle();
      const tz =
        (cfg as { timezone?: string } | null)?.timezone ?? DEFAULT_TZ;
      const fechaClinica = clinicTodayIso(tz);
      const { startIso, endIso } = clinicDayBoundsUtc(fechaClinica, tz);

      const canSeeCaja = allowed.has("caja");
      const canSeeInventario = allowed.has("inventario");

      const [
        { count: apptCount },
        { count: waitCount },
        { data: payments },
        { data: lowStock },
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", staff.clinicId)
          .gte("inicio", startIso)
          .lt("inicio", endIso)
          .not("estado", "in", "(cancelado,no_asistio)"),
        supabase
          .from("daily_queue")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", staff.clinicId)
          .eq("estado", "en_sala_espera")
          .eq("fecha", fechaClinica),
        canSeeCaja
          ? supabase
              .from("payments")
              .select("monto, metodo_pago, estado, cajero_id, fecha_pago")
              .eq("clinic_id", staff.clinicId)
              .eq("estado", "pagado")
              .gte("fecha_pago", startIso)
              .lt("fecha_pago", endIso)
          : Promise.resolve({
              data: [] as Array<{
                monto: string;
                metodo_pago: string;
                estado: string;
                cajero_id: string | null;
                fecha_pago: string | null;
              }>,
            }),
        canSeeInventario
          ? supabase
              .from("product_stock")
              .select("product_id")
              .eq("clinic_id", staff.clinicId)
              .eq("bajo_minimo", true)
              .eq("activo", true)
          : Promise.resolve({ data: [] as Array<{ product_id: string }> }),
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

  const showCola = !staff || allowed.has("cola");
  const showInventario = allowed.has("inventario");
  const showReportes = allowed.has("reportes");
  const showCaja = allowed.has("caja");
  const showAgenda = allowed.has("agenda");
  const showPacientes = allowed.has("pacientes");

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
        {showCaja ? (
          <div className="border-brand/15 bg-surface rounded-xl border p-5">
            <p className="text-muted text-sm">Ingresos del día</p>
            <p className="text-brand mt-1 text-3xl font-semibold">
              {ingresosHoy}
            </p>
          </div>
        ) : null}
        {showInventario ? (
          <div className="border-brand/15 bg-surface rounded-xl border p-5">
            <p className="text-muted text-sm">Alertas de stock</p>
            <p className="text-brand mt-1 text-3xl font-semibold">
              {alertasStock}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        {showCola ? (
          <ActionButton href="/app/cola">Abrir cola del día</ActionButton>
        ) : null}
        {showAgenda ? (
          <ActionButton href="/app/agenda" variant="secondary">
            Agenda
          </ActionButton>
        ) : null}
        {showPacientes ? (
          <ActionButton href="/app/pacientes" variant="secondary">
            Pacientes
          </ActionButton>
        ) : null}
        {showInventario ? (
          <ActionButton href="/app/inventario" className="!bg-accent">
            Inventario
          </ActionButton>
        ) : null}
        {showReportes ? (
          <ActionButton href="/app/reportes" variant="secondary">
            Reportes
          </ActionButton>
        ) : null}
        {showCaja ? (
          <ActionButton href="/app/caja" variant="secondary">
            Ver caja
          </ActionButton>
        ) : null}
      </div>
    </main>
  );
}
