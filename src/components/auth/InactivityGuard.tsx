"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type InactivityGuardProps = {
  /** Minutos de inactividad antes del cierre (§2.5). */
  minutes: number;
  /** Segundos de aviso previo. */
  warningSeconds?: number;
  onLogout?: () => void;
};

/**
 * Auto-logout por inactividad con aviso 60 s antes.
 * 15 min recepción / 30 min terapeuta y admin.
 */
export function InactivityGuard({
  minutes,
  warningSeconds = 60,
  onLogout,
}: InactivityGuardProps) {
  const timeoutMs = minutes * 60_000;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(0);
  const warningTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onLogout?.();
    window.location.href = "/login?razon=inactividad";
  }, [onLogout]);

  const bump = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    lastActivity.current = Date.now();
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    warningTimer.current = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      const remaining = timeoutMs - idle;
      if (remaining <= 0) {
        void logout();
        return;
      }
      if (remaining <= warningSeconds * 1000) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      if (warningTimer.current) clearInterval(warningTimer.current);
    };
  }, [bump, logout, timeoutMs, warningSeconds]);

  if (secondsLeft === null) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-surface text-foreground border-brand/20 max-w-md rounded-lg border p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Sesión por expirar</h2>
        <p className="text-muted mt-2 text-sm">
          Por inactividad, su sesión se cerrará en <strong>{secondsLeft}s</strong>. Mueva
          el mouse o pulse una tecla para continuar.
        </p>
        <button
          type="button"
          onClick={bump}
          className="bg-brand mt-4 w-full rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 sm:w-auto"
        >
          Seguir trabajando
        </button>
      </div>
    </div>
  );
}
