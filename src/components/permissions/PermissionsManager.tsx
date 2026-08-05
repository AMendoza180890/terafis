"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import {
  getStaffMenuOverridesAction,
  listRoleMenuPermissionsAction,
  listStaffForPermissionsAction,
  saveRoleMenuPermissionsAction,
  saveStaffMenuOverridesAction,
} from "@/lib/permissions/actions";
import {
  MENU_CATALOG,
  MENU_KEYS,
  resolveEffectiveMenuKeys,
  type MenuKey,
} from "@/lib/permissions/menu-catalog";
import type { StaffRole } from "@/lib/roles";

type StaffOpt = {
  id: string;
  nombre: string;
  email: string;
  rol: StaffRole;
  activo: boolean;
};

type OverrideMode = "inherit" | "allow" | "deny";

const ROLES: Array<{ value: StaffRole; label: string }> = [
  { value: "admin", label: "Administrador" },
  { value: "recepcionista", label: "Recepción" },
  { value: "terapeuta", label: "Fisioterapeuta" },
];

export function PermissionsManager({ currentStaffId }: { currentStaffId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"rol" | "usuario">("rol");

  const [rol, setRol] = useState<StaffRole>("recepcionista");
  const [roleAllowed, setRoleAllowed] = useState<Set<MenuKey>>(new Set());

  const [staffList, setStaffList] = useState<StaffOpt[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffRol, setStaffRol] = useState<StaffRole>("terapeuta");
  const [roleDefaults, setRoleDefaults] = useState<Partial<Record<MenuKey, boolean>>>({});
  const [modes, setModes] = useState<Partial<Record<MenuKey, OverrideMode>>>({});

  useEffect(() => {
    startTransition(async () => {
      const res = await listRoleMenuPermissionsAction(rol);
      if (!res.ok) {
        toast.error("Permisos", res.error);
        return;
      }
      setRoleAllowed(new Set(res.allowedKeys));
      if (res.missingMigration) {
        toast.error(
          "Migración pendiente",
          "Ejecute 20260731020000_menu_permissions.sql en Supabase",
        );
      }
    });
  }, [rol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "usuario") return;
    startTransition(async () => {
      const res = await listStaffForPermissionsAction();
      if (!res.ok) {
        toast.error("Staff", res.error);
        return;
      }
      setStaffList(res.staff);
      if (!selectedStaffId && res.staff[0]) {
        setSelectedStaffId(res.staff[0].id);
      }
    });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "usuario" || !selectedStaffId) return;
    startTransition(async () => {
      const res = await getStaffMenuOverridesAction(selectedStaffId);
      if (!res.ok) {
        toast.error("Overrides", res.error);
        return;
      }
      setStaffRol(res.rol);
      setRoleDefaults(res.roleDefaults);
      const next: Partial<Record<MenuKey, OverrideMode>> = {};
      for (const key of MENU_KEYS) {
        if (res.overrides[key] === true) next[key] = "allow";
        else if (res.overrides[key] === false) next[key] = "deny";
        else next[key] = "inherit";
      }
      setModes(next);
    });
  }, [tab, selectedStaffId]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectivePreview = useMemo(() => {
    const overrides: Partial<Record<MenuKey, boolean>> = {};
    for (const key of MENU_KEYS) {
      const mode = modes[key] ?? "inherit";
      if (mode === "allow") overrides[key] = true;
      if (mode === "deny") overrides[key] = false;
    }
    return resolveEffectiveMenuKeys({
      role: staffRol,
      roleDefaults,
      overrides,
    });
  }, [modes, roleDefaults, staffRol]);

  function toggleRoleKey(key: MenuKey) {
    if (key === "inicio") return;
    if (rol === "admin" && key === "permisos") return;
    setRoleAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      next.add("inicio");
      if (rol === "admin") next.add("permisos");
      return next;
    });
  }

  function setMode(key: MenuKey, mode: OverrideMode) {
    if (key === "inicio") return;
    if (selectedStaffId === currentStaffId && key === "permisos" && mode === "deny") {
      toast.error("Permisos", "No puede quitarse a sí mismo el acceso a Permisos");
      return;
    }
    setModes((prev) => ({ ...prev, [key]: mode }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "rol"} onClick={() => setTab("rol")}>
          Por rol
        </TabButton>
        <TabButton active={tab === "usuario"} onClick={() => setTab("usuario")}>
          Por usuario
        </TabButton>
      </div>

      {tab === "rol" ? (
        <section className="border-brand/15 bg-surface space-y-4 rounded-xl border p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Rol</span>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as StaffRole)}
                className="border-brand/20 bg-background rounded-md border px-3 py-2"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending}
              className="bg-brand rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() =>
                startTransition(async () => {
                  const res = await saveRoleMenuPermissionsAction({
                    rol,
                    allowedKeys: [...roleAllowed],
                  });
                  toast.fromActionResult(res, "Permisos del rol guardados");
                  if (res.ok) router.refresh();
                })
              }
            >
              {pending ? "Guardando…" : "Guardar rol"}
            </button>
          </div>
          <p className="text-muted text-sm">
            Define el menú base del rol. Los usuarios pueden tener excepciones en la
            pestaña «Por usuario».
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MENU_CATALOG.map((item) => {
              const locked =
                item.key === "inicio" || (rol === "admin" && item.key === "permisos");
              const checked = roleAllowed.has(item.key);
              return (
                <li key={item.key}>
                  <label className="border-brand/10 flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked || pending}
                      onChange={() => toggleRoleKey(item.key)}
                      className="rounded"
                    />
                    <span>
                      {item.label}
                      {locked ? (
                        <span className="text-muted ml-1 text-xs">(fijo)</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="border-brand/15 bg-surface space-y-4 rounded-xl border p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[16rem] flex-1 text-sm">
              <span className="text-muted mb-1 block">Usuario</span>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.rol}
                    {!s.activo ? ", inactivo" : ""})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !selectedStaffId}
              className="bg-brand rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() =>
                startTransition(async () => {
                  const overrides: Partial<Record<MenuKey, boolean>> = {};
                  for (const key of MENU_KEYS) {
                    const mode = modes[key] ?? "inherit";
                    if (mode === "allow") overrides[key] = true;
                    if (mode === "deny") overrides[key] = false;
                  }
                  const res = await saveStaffMenuOverridesAction({
                    staffId: selectedStaffId,
                    overrides,
                  });
                  toast.fromActionResult(res, "Excepciones del usuario guardadas");
                  if (res.ok) router.refresh();
                })
              }
            >
              {pending ? "Guardando…" : "Guardar usuario"}
            </button>
          </div>
          <p className="text-muted text-sm">
            Rol del usuario: <strong>{staffRol}</strong>. Elija heredar el rol, forzar
            acceso o quitar acceso por opción.
          </p>
          <ul className="space-y-2">
            {MENU_CATALOG.map((item) => {
              const mode = modes[item.key] ?? "inherit";
              const roleHas = roleDefaults[item.key] === true;
              const effective = effectivePreview.has(item.key);
              const locked = item.key === "inicio";
              return (
                <li
                  key={item.key}
                  className="border-brand/10 flex flex-col gap-2 rounded-md border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-muted text-xs">
                      Rol: {roleHas ? "sí" : "no"} · Efectivo: {effective ? "sí" : "no"}
                      {mode !== "inherit" ? " · excepción" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ["inherit", "Heredar"],
                        ["allow", "Forzar sí"],
                        ["deny", "Forzar no"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={locked || pending}
                        onClick={() => setMode(item.key, value)}
                        className={[
                          "rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50",
                          mode === value
                            ? "border-brand bg-brand text-white"
                            : "border-brand/20 text-foreground",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-4 py-2 text-sm font-semibold",
        active ? "bg-brand text-white" : "border-brand/20 text-foreground border",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
