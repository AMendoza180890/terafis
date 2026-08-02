import { ConfigForms } from "@/components/config/ConfigForms";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { DEFAULT_TZ } from "@/lib/datetime/clinic-tz";
import { requireMenuAccess } from "@/lib/permissions/require";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Configuración — Terafis" };

export default async function ConfiguracionPage() {
  const staff = await getCurrentStaff();
  await requireMenuAccess(staff, "configuracion");
  let clinicNombre = "";
  let timezone = DEFAULT_TZ;
  let direccion = "";
  let telefono = "";
  let rfc = "";
  let temaDefecto: "claro" | "oscuro" | "sistema" = "sistema";

  if (staff) {
    const supabase = await createClient();
    const [{ data: clinic }, { data: cfg }] = await Promise.all([
      supabase.from("clinics").select("nombre").eq("id", staff.clinicId).maybeSingle(),
      supabase
        .from("clinic_config")
        .select("timezone, direccion, telefono, rfc, tema_defecto")
        .eq("clinic_id", staff.clinicId)
        .maybeSingle(),
    ]);

    clinicNombre = (clinic as { nombre?: string } | null)?.nombre ?? "";
    const c = cfg as {
      timezone?: string;
      direccion?: string | null;
      telefono?: string | null;
      rfc?: string | null;
      tema_defecto?: "claro" | "oscuro" | "sistema";
    } | null;
    timezone = c?.timezone ?? DEFAULT_TZ;
    direccion = c?.direccion ?? "";
    telefono = c?.telefono ?? "";
    rfc = c?.rfc ?? "";
    temaDefecto = c?.tema_defecto ?? "sistema";
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Configuración</h1>
        <p className="text-muted mt-1 text-sm">Datos de clínica y zona horaria IANA.</p>
      </div>

      {staff?.rol !== "admin" ? (
        <p className="bg-brand-soft text-foreground rounded-md p-3 text-sm">
          Solo lectura para su rol. La edición está reservada al administrador.
        </p>
      ) : null}

      {staff?.rol === "admin" ? (
        <ConfigForms
          initial={{
            nombre: clinicNombre,
            timezone,
            direccion,
            telefono,
            rfc,
            temaDefecto,
          }}
        />
      ) : (
        <section className="border-brand/15 bg-surface rounded-xl border p-5 text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Nombre</dt>
              <dd className="font-medium">{clinicNombre || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Timezone</dt>
              <dd className="font-medium">{timezone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Dirección</dt>
              <dd className="font-medium">{direccion || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Teléfono</dt>
              <dd className="font-medium">{telefono || "—"}</dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
