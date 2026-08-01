"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AppFooter } from "@/components/app/AppFooter";
import { UserMenu, type UserMenuProfile } from "@/components/app/UserMenu";
import { TerafisLogo } from "@/components/brand/TerafisLogo";
import {
  NotificationCenter,
  type NotificationItem,
} from "@/components/notifications/NotificationCenter";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import type { MenuKey } from "@/lib/permissions/menu-catalog";

const SIDEBAR_KEY = "terafis_sidebar_open";

type IconProps = { className?: string };

const links: Array<{
  href: string;
  label: string;
  menuKey: MenuKey;
  icon: (props: IconProps) => ReactNode;
}> = [
  { href: "/app", label: "Inicio", menuKey: "inicio", icon: HomeIcon },
  { href: "/app/pacientes", label: "Pacientes", menuKey: "pacientes", icon: UsersIcon },
  { href: "/app/doctores", label: "Doctores", menuKey: "doctores", icon: DoctorIcon },
  { href: "/app/agenda", label: "Agenda", menuKey: "agenda", icon: CalendarIcon },
  { href: "/app/cola", label: "Cola", menuKey: "cola", icon: QueueIcon },
  { href: "/app/servicios", label: "Servicios", menuKey: "servicios", icon: ServicesIcon },
  { href: "/app/caja", label: "Caja", menuKey: "caja", icon: CashIcon },
  { href: "/app/inventario", label: "Inventario", menuKey: "inventario", icon: BoxIcon },
  { href: "/app/reportes", label: "Reportes", menuKey: "reportes", icon: ChartIcon },
  { href: "/app/planes", label: "Planes", menuKey: "planes", icon: PlanIcon },
  { href: "/app/staff", label: "Staff", menuKey: "staff", icon: StaffIcon },
  { href: "/app/auditoria", label: "Auditoría", menuKey: "auditoria", icon: AuditIcon },
  { href: "/app/permisos", label: "Permisos", menuKey: "permisos", icon: LockIcon },
  { href: "/app/configuracion", label: "Configuración", menuKey: "configuracion", icon: SettingsIcon },
];

export function AppShell({
  userProfile,
  clinicId,
  notifications,
  allowedMenuKeys,
  children,
}: {
  userProfile: UserMenuProfile;
  clinicId: string | null;
  notifications: NotificationItem[];
  /** Claves de menú efectivas; si null, muestra todo menos permisos (modo local). */
  allowedMenuKeys: MenuKey[] | null;
  children: ReactNode;
}) {
  const visibleLinks = links.filter((l) => {
    if (!allowedMenuKeys) {
      return l.menuKey !== "permisos";
    }
    return allowedMenuKeys.includes(l.menuKey);
  });
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
    return true;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showLabels = sidebarOpen;

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  function navigate(href: string) {
    setMobileMenuOpen(false);
    router.push(href);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-brand/15 bg-surface/95 sticky top-0 z-40 border-b backdrop-blur print:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={
                showLabels
                  ? "Contraer menú a iconos"
                  : "Expandir menú con etiquetas"
              }
              aria-expanded={showLabels}
              aria-controls="app-sidebar"
              title={showLabels ? "Solo iconos" : "Menú completo"}
              className="text-foreground hover:bg-brand-soft hidden h-10 w-10 shrink-0 items-center justify-center rounded-md md:inline-flex"
            >
              <MenuIcon open={showLabels} />
            </button>
            <TerafisLogo href="/app" height={34} className="max-h-9" />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeSelector />
            <NotificationCenter clinicId={clinicId} initial={notifications} />
            <UserMenu profile={userProfile} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Escritorio: barra lateral */}
        <aside
          id="app-sidebar"
          className={[
            "border-brand/15 bg-surface hidden shrink-0 overflow-x-hidden overflow-y-auto border-r transition-[width] duration-200 ease-out md:block print:hidden",
            showLabels ? "md:w-56" : "md:w-14",
          ].join(" ")}
        >
          <nav
            className={[
              "flex flex-col gap-0.5 py-3",
              showLabels
                ? "md:w-56 md:items-stretch md:px-3"
                : "md:w-14 md:items-center md:px-1.5",
            ].join(" ")}
            aria-label="Menú del sistema"
          >
            {visibleLinks.map((link) => (
              <NavItem
                key={link.href}
                link={link}
                active={isActive(pathname, link.href)}
                showLabel={showLabels}
                onNavigate={() => navigate(link.href)}
                layout="sidebar"
              />
            ))}
          </nav>
        </aside>

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
          {children}
        </div>
      </div>

      <AppFooter className="mt-auto mb-[4.5rem] md:mb-0" />

      {/* Móvil: menú inferior con toggle */}
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/35 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-50 md:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {mobileMenuOpen ? (
          <nav
            id="app-mobile-menu"
            className="border-brand/15 bg-surface max-h-[70vh] overflow-y-auto rounded-t-2xl border-t px-3 pt-3 pb-2 shadow-lg"
            aria-label="Menú del sistema"
          >
            <p className="text-muted mb-2 px-1 text-xs font-medium tracking-wide uppercase">
              Navegación
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visibleLinks.map((link) => (
                <NavItem
                  key={link.href}
                  link={link}
                  active={isActive(pathname, link.href)}
                  showLabel
                  onNavigate={() => navigate(link.href)}
                  layout="bottom"
                />
              ))}
            </div>
          </nav>
        ) : null}

        <div className="border-brand/15 bg-surface/95 border-t px-3 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="app-mobile-menu"
            className="bg-brand flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white"
          >
            <MenuIcon open={mobileMenuOpen} />
            Menú
          </button>
        </div>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

function NavItem({
  link,
  active,
  showLabel,
  onNavigate,
  layout,
}: {
  link: (typeof links)[number];
  active: boolean;
  showLabel: boolean;
  onNavigate: () => void;
  layout: "sidebar" | "bottom";
}) {
  const Icon = link.icon;
  const base =
    layout === "bottom"
      ? "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-center text-xs"
      : [
          "flex shrink-0 items-center justify-center rounded-md text-sm",
          "h-10 w-10",
          showLabel
            ? "md:h-auto md:w-full md:justify-start md:gap-3 md:px-3 md:py-2.5"
            : "",
        ].join(" ");

  return (
    <button
      type="button"
      title={link.label}
      aria-label={link.label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={
        active
          ? `${base} bg-brand font-medium text-white`
          : `${base} text-muted hover:bg-brand-soft hover:text-foreground`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {showLabel ? (
        <span className={layout === "bottom" ? "leading-tight" : "truncate"}>
          {link.label}
        </span>
      ) : null}
    </button>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      {open ? (
        <>
          <path
            d="M4 6h10M4 12h16M4 18h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18 8l-4 4 4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <path
          d="M4 6h16M4 12h16M4 18h16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M16 19a4.5 4.5 0 0 1 4.5-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DoctorIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M6 20v-1a6 6 0 0 1 12 0v1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 11v4M10 13h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function QueueIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ServicesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 3 4.5 7v5c0 4.2 3.1 7.9 7.5 9 4.4-1.1 7.5-4.8 7.5-9V7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BoxIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4 8.5 12 4l8 4.5V16l-8 4.5L4 16V8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 12v8.5M4 8.5l8 3.5 8-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 19h16M7 16V10M12 16V7M17 16v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PlanIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M8 4h9a2 2 0 0 1 2 2v13l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 9h6M10 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function StaffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 19.5a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AuditIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-3-1.5L12 20l-3-1.5L6 20V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 10h5M9.5 14h3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
