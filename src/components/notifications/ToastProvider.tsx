"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "exito" | "error" | "info";

export type ToastInput = {
  kind: ToastKind;
  title: string;
  description?: string;
  /** Duración en ms; errores duran más por defecto */
  durationMs?: number;
  /** Si true, intenta Notification API del navegador */
  push?: boolean;
};

type ToastItem = ToastInput & { id: string };

type ToastContextValue = {
  push: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  fromActionResult: (
    result: { ok: true } | { ok: false; error: string },
    successTitle: string,
    successDescription?: string,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

async function maybeBrowserPush(toast: ToastInput) {
  if (!toast.push) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;
    new Notification(toast.title, {
      body: toast.description,
      icon: "/brand/terafis-icon-v2.png",
      tag: `terafis-${toast.kind}`,
    });
  } catch {
    // silencioso si el navegador bloquea
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = `toast-${++toastId}`;
      const duration =
        toast.durationMs ?? (toast.kind === "error" ? 7000 : 4500);
      setItems((prev) => [...prev, { ...toast, id }].slice(-5));
      void maybeBrowserPush(toast);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) =>
        push({ kind: "exito", title, description, push: true }),
      error: (title, description) =>
        push({ kind: "error", title, description, push: true }),
      info: (title, description) =>
        push({ kind: "info", title, description }),
      fromActionResult: (result, successTitle, successDescription) => {
        if (result.ok) {
          push({
            kind: "exito",
            title: successTitle,
            description: successDescription,
            push: true,
          });
        } else {
          push({
            kind: "error",
            title: "No se pudo completar",
            description: result.error,
            push: true,
          });
        }
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={[
              "pointer-events-auto rounded-lg border px-4 py-3 shadow-lg backdrop-blur",
              toast.kind === "exito" &&
                "border-verde/40 bg-surface text-foreground",
              toast.kind === "error" &&
                "border-red-400/50 bg-surface text-foreground",
              toast.kind === "info" &&
                "border-brand/30 bg-surface text-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                  toast.kind === "exito" && "bg-verde",
                  toast.kind === "error" && "bg-red-600",
                  toast.kind === "info" && "bg-brand",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              >
                {toast.kind === "exito" ? "✓" : toast.kind === "error" ? "!" : "i"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? (
                  <p className="text-muted mt-0.5 text-xs leading-relaxed">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="text-muted hover:text-foreground rounded p-1 text-xs"
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}
