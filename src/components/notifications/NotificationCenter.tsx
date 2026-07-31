"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { clearAllNotificationsAction, markReadAction } from "@/lib/notifications/actions";
import { createClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  created_at: string;
};

const SOUND_KEY = "terafis_notif_sound";

export function NotificationCenter({
  clinicId,
  initial,
}: {
  clinicId: string | null;
  initial: NotificationItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  const [soundOn, setSoundOn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SOUND_KEY) === "1";
  });
  const [pending, startTransition] = useTransition();
  const [liveMessage, setLiveMessage] = useState("");
  const unread = items.filter((i) => !i.leida).length;

  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  useEffect(() => {
    if (!clinicId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notif:${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          const row = payload.new as NotificationItem;
          setItems((prev) => [row, ...prev].slice(0, 50));
          setLiveMessage(`Nueva notificación: ${row.titulo}`);
          if (localStorage.getItem(SOUND_KEY) === "1") {
            try {
              const audio = new Audio("/sounds/notify.mp3");
              void audio.play().catch(() => undefined);
            } catch {
              // silencio si el navegador bloquea audio
            }
          }
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clinicId, router]);

  return (
    <div className="relative">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
      <button
        type="button"
        className="text-muted hover:bg-brand-soft relative rounded-md px-2 py-1.5 text-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : "Notificaciones"
        }
        onClick={() => setOpen((v) => !v)}
      >
        Avisos
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="border-brand/15 bg-surface absolute right-0 z-40 mt-2 w-80 rounded-xl border p-3 shadow-lg"
          role="dialog"
          aria-label="Notificaciones"
          aria-live="polite"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-muted text-xs"
                onClick={() => {
                  const next = !soundOn;
                  setSoundOn(next);
                  localStorage.setItem(SOUND_KEY, next ? "1" : "0");
                }}
              >
                {soundOn ? "🔊 Sonido" : "🔇 Sonido"}
              </button>
              <button
                type="button"
                className="text-muted text-xs"
                onClick={() => {
                  if (!("Notification" in window)) return;
                  void Notification.requestPermission();
                }}
              >
                🔔 Push
              </button>
            </div>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {items.length === 0 ? (
              <li className="text-muted py-4 text-center text-xs">Sin avisos</li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={
                    n.leida
                      ? "rounded-md border border-transparent px-2 py-2"
                      : "border-brand/20 bg-brand-soft/40 rounded-md border px-2 py-2"
                  }
                >
                  <p className="font-medium">{n.titulo}</p>
                  <p className="text-muted text-xs">{n.cuerpo}</p>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={pending || unread === 0}
              className="bg-brand w-full rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40 sm:w-auto"
              onClick={() =>
                startTransition(async () => {
                  const ids = items.filter((i) => !i.leida).map((i) => i.id);
                  await markReadAction(ids);
                  setItems((prev) => prev.map((i) => ({ ...i, leida: true })));
                  router.refresh();
                })
              }
            >
              Marcar leídas
            </button>
            <button
              type="button"
              disabled={pending}
              className="border-brand/30 text-muted hover:bg-brand-soft w-full rounded-md border px-2.5 py-1 text-xs disabled:opacity-40 sm:w-auto"
              onClick={() =>
                startTransition(async () => {
                  await clearAllNotificationsAction();
                  setItems((prev) => prev.map((i) => ({ ...i, leida: true })));
                  router.refresh();
                })
              }
            >
              Limpiar todas
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
