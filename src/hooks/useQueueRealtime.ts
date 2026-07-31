"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Suscribe a postgres_changes de daily_queue filtrado por clinic_id.
 * Recarga la UI al recibir eventos (RLS aplica en el canal).
 */
export function useQueueRealtime(clinicId: string | null) {
  const router = useRouter();

  useEffect(() => {
    if (!clinicId) return;

    let active = true;
    const supabase = createClient();
    const channel = supabase
      .channel(`queue:${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_queue",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          if (active) router.refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          if (active) router.refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [clinicId, router]);
}
