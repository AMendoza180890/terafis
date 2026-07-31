import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TokenAction = "confirmar" | "cancelar" | "reagendar";

export type IssuedToken = {
  accion: TokenAction;
  /** Token en claro — solo para armar el link; NUNCA persistir. */
  token: string;
  tokenHash: string;
  expiraEn: string;
  urlPath: string;
};

/**
 * Emite tokens opacos por acción. En BD solo se guarda el hash SHA-256.
 * Expiración: min(inicio cita, now+48h).
 */
export async function issueAppointmentActionTokens(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    appointmentId: string;
    inicioUtc: Date;
  },
): Promise<IssuedToken[]> {
  const maxExp = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const expiraEn = new Date(
    Math.min(params.inicioUtc.getTime(), maxExp.getTime()),
  ).toISOString();

  const actions: TokenAction[] = ["confirmar", "cancelar", "reagendar"];
  const issued: IssuedToken[] = [];

  for (const accion of actions) {
    const token = generateOpaqueToken();
    const tokenHash = hashToken(token);

    const { error } = await supabase.from("appointment_action_tokens").upsert(
      {
        clinic_id: params.clinicId,
        appointment_id: params.appointmentId,
        accion,
        token_hash: tokenHash,
        expira_en: expiraEn,
        usado_en: null,
      },
      { onConflict: "appointment_id,accion" },
    );

    if (error) {
      console.error("No se pudo emitir token:", accion, error.message);
      continue;
    }

    issued.push({
      accion,
      token,
      tokenHash,
      expiraEn,
      urlPath: `/cita/${accion}/${token}`,
    });
  }

  return issued;
}

export function genericTokenErrorMessage(): string {
  // Sin enumeración de estado interno
  return "El enlace no es válido o ya no está disponible.";
}
