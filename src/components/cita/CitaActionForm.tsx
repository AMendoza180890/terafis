"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";

import { AutoTextarea } from "@/components/ui/AutoTextarea";

type Props = {
  accion: "confirmar" | "cancelar" | "reagendar";
  token: string;
  turnstileSiteKey?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void },
      ) => string;
    };
  }
}

export function CitaActionForm({ accion, token, turnstileSiteKey }: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetRendered = useRef(false);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileScriptReady || widgetRendered.current) return;
    if (!widgetRef.current || !window.turnstile) return;
    widgetRendered.current = true;
    window.turnstile.render(widgetRef.current, {
      sitekey: turnstileSiteKey,
      callback: (t: string) => setTurnstileToken(t),
    });
  }, [turnstileSiteKey, turnstileScriptReady]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cita/accion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          accion,
          motivo: accion === "cancelar" ? motivo : undefined,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo completar la acción.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="border-brand/20 bg-surface rounded-xl border p-5" role="status">
        <p className="font-semibold">
          {accion === "confirmar" && "¡Gracias! Asistencia confirmada."}
          {accion === "cancelar" && "Cita cancelada."}
          {accion === "reagendar" && "Solicitud registrada. Recepción le contactará."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-brand/15 bg-surface space-y-4 rounded-xl border p-5"
    >
      {accion === "cancelar" ? (
        <label className="block text-sm">
          <span className="text-muted mb-1 block">Motivo (opcional)</span>
          <AutoTextarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            minRows={2}
            className="border-brand/20 bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {turnstileSiteKey ? (
        <>
          <div ref={widgetRef} />
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            async
            defer
            onReady={() => setTurnstileScriptReady(true)}
          />
        </>
      ) : null}

      <button
        type="submit"
        disabled={pending || (Boolean(turnstileSiteKey) && !turnstileToken)}
        className={
          accion === "cancelar"
            ? "w-full rounded-md bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            : "bg-brand w-full rounded-md px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        }
      >
        {pending
          ? "Procesando…"
          : accion === "confirmar"
            ? "✅ SÍ, ASISTIRÉ"
            : accion === "cancelar"
              ? "❌ CANCELAR CITA"
              : "Solicitar reagendar"}
      </button>
    </form>
  );
}
