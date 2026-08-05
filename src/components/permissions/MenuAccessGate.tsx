"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  menuKeyFromPathname,
  staffHasMenuAccess,
  type MenuKey,
} from "@/lib/permissions/menu-catalog";

export function MenuAccessGate({
  allowedKeys,
  children,
}: {
  allowedKeys: MenuKey[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/app";
  const key = menuKeyFromPathname(pathname);
  if (!staffHasMenuAccess(allowedKeys, key)) {
    return (
      <div className="space-y-3 py-8">
        <h1 className="font-serif text-2xl">Sin permiso</h1>
        <p className="text-muted text-sm">
          No tiene acceso a esta sección del menú. Contacte al administrador si necesita
          habilitarla.
        </p>
        <Link
          href="/app"
          className="text-brand text-sm font-medium underline-offset-2 hover:underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }
  return children;
}
