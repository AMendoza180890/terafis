-- Fase 3 — Comunicación
-- Tokens de cita un solo uso, entregas de recordatorios, sync Calendar, planes de tratamiento.

CREATE TYPE appointment_token_action AS ENUM ('confirmar', 'cancelar', 'reagendar');
CREATE TYPE delivery_channel AS ENUM ('email', 'sms', 'whatsapp', 'push', 'in_app');
CREATE TYPE delivery_status AS ENUM (
  'pendiente', 'enviando', 'enviado', 'fallido', 'cancelado'
);
CREATE TYPE calendar_sync_status AS ENUM (
  'pendiente', 'enviando', 'sincronizado', 'fallido', 'cancelado'
);

-- ---------------------------------------------------------------------------
-- Tokens de acción de cita (§2.4)
-- ---------------------------------------------------------------------------

CREATE TABLE appointment_action_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  accion appointment_token_action NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, accion)
);

CREATE INDEX appointment_action_tokens_appt_idx
  ON appointment_action_tokens(appointment_id);

-- ---------------------------------------------------------------------------
-- Entregas de notificaciones / recordatorios (reintentos + backoff)
-- ---------------------------------------------------------------------------

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  canal delivery_channel NOT NULL,
  plantilla TEXT NOT NULL,
  destino TEXT NOT NULL, -- email/tel enmascarable; no loguear en claro en audit
  payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- SIN datos clínicos
  estado delivery_status NOT NULL DEFAULT 'pendiente',
  intentos INT NOT NULL DEFAULT 0,
  max_intentos INT NOT NULL DEFAULT 5,
  proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_error TEXT,
  enviado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notification_deliveries_due_idx
  ON notification_deliveries(estado, proximo_intento_en)
  WHERE estado IN ('pendiente', 'fallido');

CREATE INDEX notification_deliveries_clinic_idx
  ON notification_deliveries(clinic_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Cola sync Google Calendar (best-effort)
-- ---------------------------------------------------------------------------

CREATE TABLE calendar_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  operacion TEXT NOT NULL CHECK (operacion IN ('upsert', 'delete')),
  google_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- sin info clínica
  estado calendar_sync_status NOT NULL DEFAULT 'pendiente',
  intentos INT NOT NULL DEFAULT 0,
  max_intentos INT NOT NULL DEFAULT 8,
  proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX calendar_sync_jobs_due_idx
  ON calendar_sync_jobs(estado, proximo_intento_en)
  WHERE estado IN ('pendiente', 'fallido');

ALTER TABLE clinic_config
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS recordatorios_email_24h BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recordatorios_sms_2h BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recordatorios_push_30m BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- ---------------------------------------------------------------------------
-- Planes de tratamiento (§7)
-- ---------------------------------------------------------------------------

CREATE TABLE treatment_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, codigo)
);

CREATE TABLE protocol_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES treatment_protocols(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  series INT,
  repeticiones INT,
  media_url TEXT,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL REFERENCES staff(id),
  protocol_id UUID REFERENCES treatment_protocols(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  version_actual INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX treatment_plans_patient_idx ON treatment_plans(patient_id);

-- Contenido clínico del plan: cifrado en app; recepción sin acceso
CREATE TABLE treatment_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  version INT NOT NULL,
  diagnostico TEXT,          -- cifrado app
  objetivo TEXT,             -- cifrado app
  frecuencia TEXT NOT NULL,  -- ej. 2x/semana (admin, no sensible)
  duracion_estimada_semanas INT,
  creado_por UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version)
);

CREATE TABLE treatment_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_version_id UUID NOT NULL REFERENCES treatment_plan_versions(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,          -- puede cifrarse si detalla patología
  series INT,
  repeticiones INT,
  media_url TEXT,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE treatment_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  terapeuta_id UUID NOT NULL REFERENCES staff(id),
  notas TEXT,                -- cifrado app
  dolor_eva SMALLINT CHECK (dolor_eva IS NULL OR (dolor_eva BETWEEN 0 AND 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE appointment_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_action_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_protocols FORCE ROW LEVEL SECURITY;
ALTER TABLE protocol_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plan_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_progress FORCE ROW LEVEL SECURITY;

-- Tokens: staff de clínica puede crear/ver; consumo vía SECURITY DEFINER
CREATE POLICY aat_select ON appointment_action_tokens
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista', 'terapeuta')
  );

CREATE POLICY aat_insert ON appointment_action_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista', 'terapeuta')
  );

-- Deliveries / calendar: admin lectura; inserts vía staff o service
CREATE POLICY nd_select ON notification_deliveries
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

CREATE POLICY nd_insert ON notification_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY nd_update ON notification_deliveries
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.is_clinic_admin()
  )
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY csj_select ON calendar_sync_jobs
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.is_clinic_admin()
  );

CREATE POLICY csj_insert ON calendar_sync_jobs
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY csj_update ON calendar_sync_jobs
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id());

-- Protocolos: lectura staff; escritura admin
CREATE POLICY tp_proto_select ON treatment_protocols
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY tp_proto_write ON treatment_protocols
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY tp_proto_ex_select ON protocol_exercises
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY tp_proto_ex_write ON protocol_exercises
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- Planes: admin todo; terapeuta con acceso al paciente; recepción NO ve versiones clínicas
CREATE POLICY tplans_select ON treatment_plans
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR (
        public.current_staff_role() = 'terapeuta'
        AND public.staff_has_patient_access(patient_id)
      )
      OR public.current_staff_role() = 'recepcionista'
    )
  );

CREATE POLICY tplans_write ON treatment_plans
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND (
      public.is_clinic_admin()
      OR terapeuta_id = public.current_staff_id()
      OR public.staff_has_patient_access(patient_id)
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

-- Versiones / ejercicios / progreso: SIN recepción
CREATE POLICY tpv_select ON treatment_plan_versions
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND EXISTS (
      SELECT 1 FROM treatment_plans p
      WHERE p.id = plan_id
        AND (
          public.is_clinic_admin()
          OR public.staff_has_patient_access(p.patient_id)
        )
    )
  );

CREATE POLICY tpv_write ON treatment_plan_versions
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

CREATE POLICY tex_select ON treatment_exercises
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

CREATE POLICY tex_write ON treatment_exercises
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

CREATE POLICY tprog_select ON treatment_progress
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

CREATE POLICY tprog_write ON treatment_progress
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

-- ---------------------------------------------------------------------------
-- RPC: consumir token (un solo uso, misma transacción)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_appointment_token(
  p_token_hash TEXT,
  p_accion appointment_token_action,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok appointment_action_tokens%ROWTYPE;
  v_appt appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_tok
  FROM appointment_action_tokens
  WHERE token_hash = p_token_hash
    AND accion = p_accion
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  IF v_tok.usado_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'used');
  END IF;

  IF v_tok.expira_en < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = v_tok.appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  -- Marcar usado en la misma transacción que la acción
  UPDATE appointment_action_tokens
     SET usado_en = now()
   WHERE id = v_tok.id;

  IF p_accion = 'confirmar' THEN
    IF v_appt.estado IN ('pendiente') THEN
      UPDATE appointments SET estado = 'confirmada', updated_at = now()
      WHERE id = v_appt.id;
    END IF;
  ELSIF p_accion = 'cancelar' THEN
    IF v_appt.estado NOT IN ('completado', 'cancelado', 'no_asistio') THEN
      UPDATE appointments SET
        estado = 'cancelado',
        notas_admin = COALESCE(notas_admin || ' | ', '') || COALESCE('Cancelado por paciente: ' || p_motivo, 'Cancelado por paciente'),
        updated_at = now()
      WHERE id = v_appt.id;

      UPDATE daily_queue SET
        estado = 'cancelado',
        version = version + 1,
        updated_at = now()
      WHERE appointment_id = v_appt.id
        AND estado NOT IN ('completado', 'cancelado');
    END IF;
  ELSIF p_accion = 'reagendar' THEN
    -- Solo marca intención; la reprogramación real la hace recepción
    NULL;
  END IF;

  INSERT INTO notifications (clinic_id, role_destino, tipo, titulo, cuerpo, payload)
  VALUES (
    v_tok.clinic_id,
    'recepcionista',
    CASE p_accion
      WHEN 'confirmar' THEN 'cita_confirmada_paciente'
      WHEN 'cancelar' THEN 'cita_cancelada_paciente'
      ELSE 'cita_reagendar_solicitud'
    END,
    CASE p_accion
      WHEN 'confirmar' THEN 'Paciente confirmó asistencia'
      WHEN 'cancelar' THEN 'Paciente canceló cita'
      ELSE 'Solicitud de reagendar'
    END,
    CASE p_accion
      WHEN 'cancelar' THEN COALESCE('Motivo: ' || p_motivo, 'Motivo: No especificado')
      ELSE 'Acción desde link de recordatorio'
    END,
    jsonb_build_object(
      'appointment_id', v_appt.id,
      'accion', p_accion::text
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', v_appt.id,
    'accion', p_accion::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_appointment_token(TEXT, appointment_token_action, TEXT) TO anon, authenticated, service_role;

-- Vista previa del token (sin datos clínicos; útil para página de confirmación)
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

  RETURN jsonb_build_object(
    'ok', true,
    'accion', p_accion::text,
    'appointment_id', v_appt.id,
    'inicio', v_appt.inicio,
    'fin', v_appt.fin,
    'clinic_nombre', v_clinic.nombre,
    'tipo_servicio', v_appt.tipo_servicio
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_appointment_token(TEXT, appointment_token_action) TO anon, authenticated, service_role;

-- Purga notificaciones > 90 días (invocable por cron)
CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
BEGIN
  DELETE FROM notifications WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_old_notifications() TO service_role;
