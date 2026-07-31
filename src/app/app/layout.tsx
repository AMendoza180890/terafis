import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/AppShell";
import { InactivityGuard } from "@/components/auth/InactivityGuard";
import type { NotificationItem } from "@/components/notifications/NotificationCenter";
import { ToastProvider } from "@/components/notifications/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { getAvatarSignedUrl } from "@/lib/profile/avatar";
import { inactivityMinutesForRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { SCHEME_COOKIE } from "@/lib/theme/resolution";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  const minutes = staff ? inactivityMinutesForRole(staff.rol) : 30;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://example.supabase.co" &&
    !staff
  ) {
    redirect("/login?error=auth");
  }

  let notifications: NotificationItem[] = [];
  let clinicTema: "claro" | "oscuro" | "sistema" = "sistema";
  let avatarUrl: string | null = null;

  if (staff) {
    try {
      const supabase = await createClient();
      const [{ data }, { data: cfg }, signed] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, tipo, titulo, cuerpo, leida, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("clinic_config")
          .select("tema_defecto")
          .eq("clinic_id", staff.clinicId)
          .maybeSingle(),
        getAvatarSignedUrl(staff.avatarPath),
      ]);
      notifications = (data ?? []) as NotificationItem[];
      clinicTema =
        (cfg as { tema_defecto?: "claro" | "oscuro" | "sistema" } | null)
          ?.tema_defecto ?? "sistema";
      avatarUrl = signed;
    } catch {
      notifications = [];
    }
  }

  const jar = await cookies();
  const schemeCookie = jar.get(SCHEME_COOKIE)?.value;
  const initialScheme =
    schemeCookie === "oscuro" || schemeCookie === "claro" ? schemeCookie : null;

  return (
    <ThemeProvider
      staffPreference={staff?.temaPreferido ?? "sistema"}
      clinicDefault={clinicTema}
      initialScheme={initialScheme}
    >
      <ToastProvider>
        {staff ? <InactivityGuard minutes={minutes} /> : null}
        <AppShell
          userProfile={{
            nombre: staff?.nombre ?? "Modo local (sin sesión)",
            email: staff?.email ?? "",
            rol: staff?.rol ?? null,
            telefono: staff?.telefono ?? null,
            especialidad: staff?.especialidad ?? null,
            cedulaProfesional: staff?.cedulaProfesional ?? null,
            avatarUrl,
          }}
          clinicId={staff?.clinicId ?? null}
          notifications={notifications}
        >
          {children}
        </AppShell>
      </ToastProvider>
    </ThemeProvider>
  );
}
