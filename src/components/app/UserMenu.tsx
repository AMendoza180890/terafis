"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/notifications/ToastProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  changePasswordAction,
  signOutAction,
  updateOwnProfileAction,
  uploadAvatarAction,
} from "@/lib/profile/actions";
import type { StaffRole } from "@/lib/roles";

export type UserMenuProfile = {
  nombre: string;
  email: string;
  rol: StaffRole | null;
  telefono: string | null;
  especialidad: string | null;
  cedulaProfesional: string | null;
  avatarUrl: string | null;
};

export function UserMenu({ profile }: { profile: UserMenuProfile }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "perfil" | "password">("menu");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarUrl(profile.avatarUrl);
  }, [profile.avatarUrl]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPanel("menu");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPanel("menu");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="border-brand/15 hover:bg-brand-soft ml-1 flex items-center gap-2 rounded-md border-l py-1 pr-1 pl-2 sm:pl-3"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setPanel("menu");
        }}
      >
        <AvatarCircle name={profile.nombre} url={avatarUrl} />
        <span className="text-foreground hidden max-w-[10rem] truncate text-sm font-medium sm:block md:max-w-[14rem]">
          {profile.nombre}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          className="border-brand/15 bg-surface absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,20rem)] rounded-xl border p-2 shadow-lg"
          role="menu"
        >
          {panel === "menu" ? (
            <>
              <div className="border-brand/10 mb-2 border-b px-2 pb-2">
                <p className="text-foreground truncate text-sm font-semibold">
                  {profile.nombre}
                </p>
                <p className="text-muted truncate text-xs">{profile.email}</p>
                {profile.rol ? (
                  <p className="text-brand mt-1 text-xs capitalize">{profile.rol}</p>
                ) : null}
              </div>
              <MenuItem
                label="Actualizar perfil"
                onClick={() => setPanel("perfil")}
              />
              <MenuItem
                label="Cambiar contraseña"
                onClick={() => setPanel("password")}
              />
              <form action={signOutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 w-full rounded-md px-3 py-2 text-left text-sm"
                >
                  Cerrar sesión
                </button>
              </form>
            </>
          ) : null}

          {panel === "perfil" ? (
            <ProfileForm
              profile={profile}
              avatarUrl={avatarUrl}
              pending={pending}
              onBack={() => setPanel("menu")}
              onAvatar={(url) => setAvatarUrl(url)}
              onSubmit={(payload) => {
                startTransition(async () => {
                  const result = await updateOwnProfileAction(payload);
                  toast.fromActionResult(result, "Perfil actualizado");
                  if (result.ok) {
                    setOpen(false);
                    setPanel("menu");
                  }
                });
              }}
              onUploadAvatar={(fd) => {
                startTransition(async () => {
                  const result = await uploadAvatarAction(fd);
                  toast.fromActionResult(result, "Foto actualizada");
                  if (result.ok && result.avatarUrl) {
                    setAvatarUrl(result.avatarUrl);
                  }
                });
              }}
            />
          ) : null}

          {panel === "password" ? (
            <PasswordForm
              pending={pending}
              onBack={() => setPanel("menu")}
              onSubmit={(payload) => {
                startTransition(async () => {
                  const result = await changePasswordAction(payload);
                  toast.fromActionResult(result, "Contraseña actualizada");
                  if (result.ok) {
                    setOpen(false);
                    setPanel("menu");
                  }
                });
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="text-foreground hover:bg-brand-soft w-full rounded-md px-3 py-2 text-left text-sm"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ProfileForm({
  profile,
  avatarUrl,
  pending,
  onBack,
  onSubmit,
  onUploadAvatar,
  onAvatar,
}: {
  profile: UserMenuProfile;
  avatarUrl: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: (payload: {
    nombre: string;
    telefono?: string;
    especialidad?: string;
    cedulaProfesional?: string;
  }) => void;
  onUploadAvatar: (fd: FormData) => void;
  onAvatar: (url: string | null) => void;
}) {
  return (
    <div className="space-y-3 p-1">
      <button
        type="button"
        className="text-brand text-xs"
        onClick={onBack}
      >
        ← Volver
      </button>
      <p className="text-sm font-semibold">Actualizar perfil</p>

      <div className="flex items-center gap-3">
        <AvatarCircle name={profile.nombre} url={avatarUrl} size={56} />
        <label className="border-brand/30 text-brand cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium">
          Cambiar foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              // preview local
              onAvatar(URL.createObjectURL(file));
              const fd = new FormData();
              fd.set("avatar", file);
              onUploadAvatar(fd);
            }}
          />
        </label>
      </div>
      <p className="text-muted text-[11px]">JPEG, PNG o WebP · máx. 2 MB</p>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            nombre: String(fd.get("nombre") ?? ""),
            telefono: String(fd.get("telefono") ?? ""),
            especialidad: String(fd.get("especialidad") ?? ""),
            cedulaProfesional: String(fd.get("cedula") ?? ""),
          });
        }}
      >
        <Field
          name="nombre"
          label="Nombre"
          defaultValue={profile.nombre}
          required
        />
        <Field
          name="telefono"
          label="Teléfono"
          defaultValue={profile.telefono ?? ""}
        />
        <Field
          name="especialidad"
          label="Especialidad"
          defaultValue={profile.especialidad ?? ""}
        />
        <Field
          name="cedula"
          label="Cédula profesional"
          defaultValue={profile.cedulaProfesional ?? ""}
        />
        <p className="text-muted text-xs">Correo: {profile.email}</p>
        <ActionButton type="submit" disabled={pending} className="w-full">
          {pending ? "Guardando…" : "Guardar cambios"}
        </ActionButton>
      </form>
    </div>
  );
}

function PasswordForm({
  pending,
  onBack,
  onSubmit,
}: {
  pending: boolean;
  onBack: () => void;
  onSubmit: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void;
}) {
  return (
    <div className="space-y-3 p-1">
      <button type="button" className="text-brand text-xs" onClick={onBack}>
        ← Volver
      </button>
      <p className="text-sm font-semibold">Cambiar contraseña</p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            currentPassword: String(fd.get("currentPassword") ?? ""),
            newPassword: String(fd.get("newPassword") ?? ""),
            confirmPassword: String(fd.get("confirmPassword") ?? ""),
          });
        }}
      >
        <Field
          name="currentPassword"
          label="Contraseña actual"
          type="password"
          required
          autoComplete="current-password"
        />
        <Field
          name="newPassword"
          label="Nueva contraseña"
          type="password"
          required
          autoComplete="new-password"
        />
        <Field
          name="confirmPassword"
          label="Confirmar nueva"
          type="password"
          required
          autoComplete="new-password"
        />
        <ActionButton type="submit" disabled={pending} className="w-full">
          {pending ? "Actualizando…" : "Actualizar contraseña"}
        </ActionButton>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block text-xs">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="border-brand/20 bg-background w-full rounded-md border px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

function AvatarCircle({
  name,
  url,
  size = 32,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed/blob URLs de avatar
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="bg-brand/10 shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="bg-brand/10 text-brand inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`text-muted h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
