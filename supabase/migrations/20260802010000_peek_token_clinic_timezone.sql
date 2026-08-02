-- peek_appointment_token: incluir timezone de la clínica para que la página
-- pública de cita formatee la hora en la TZ real, no en DEFAULT_TZ fijo.
CREATE OR REPLACE FUNCTION public.peek_appointment_token(
  p_token_hash TEXT,
  p_accion appointment_token_action
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok appointment_action_tokens%ROWTYPE;
  v_appt appointments%ROWTYPE;
  v_clinic clinics%ROWTYPE;
  v_timezone TEXT;
BEGIN
  SELECT * INTO v_tok
  FROM appointment_action_tokens
  WHERE token_hash = p_token_hash AND accion = p_accion;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  IF v_tok.usado_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'used');
  END IF;

  IF v_tok.expira_en < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = v_tok.appointment_id;
  SELECT * INTO v_clinic FROM clinics WHERE id = v_tok.clinic_id;
  SELECT timezone INTO v_timezone FROM clinic_config WHERE clinic_id = v_tok.clinic_id;

  RETURN jsonb_build_object(
    'ok', true,
    'accion', p_accion::text,
    'appointment_id', v_appt.id,
    'inicio', v_appt.inicio,
    'fin', v_appt.fin,
    'clinic_nombre', v_clinic.nombre,
    'clinic_timezone', COALESCE(v_timezone, 'America/Managua'),
    'tipo_servicio', v_appt.tipo_servicio
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_appointment_token(TEXT, appointment_token_action) TO anon, authenticated, service_role;
