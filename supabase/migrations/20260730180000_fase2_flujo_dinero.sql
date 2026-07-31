-- Fase 2 — Flujo de atención y dinero
-- Servicios, cola diaria (optimistic locking), pagos (idempotencia), notificaciones mínimas.

CREATE TYPE service_tipo AS ENUM (
  'consulta_evaluacion',
  'consulta_seguimiento',
  'sesion_terapia',
  'paquete_sesiones',
  'producto',
  'estudio_especial',
  'otro'
);

CREATE TYPE payment_method AS ENUM ('cash', 'transferencia');
CREATE TYPE payment_status AS ENUM ('pendiente', 'pagado', 'reembolsado', 'cancelado');

CREATE TYPE queue_status AS ENUM (
  'pendiente',
  'en_sala_espera',
  'en_consulta',
  'pendiente_pago',
  'completado',
  'no_asistio',
  'cancelado'
);

-- ---------------------------------------------------------------------------
-- Catálogo de servicios
-- ---------------------------------------------------------------------------

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  tipo service_tipo NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  costo NUMERIC(10,2) NOT NULL CHECK (costo >= 0),
  duracion_minutos INT CHECK (duracion_minutos IS NULL OR duracion_minutos > 0),
  requiere_autorizacion BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX services_clinic_idx ON services(clinic_id);

CREATE TABLE appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  costo_aplicado NUMERIC(10,2) NOT NULL CHECK (costo_aplicado >= 0),
  cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  terapeuta_id UUID REFERENCES staff(id),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX appointment_services_appt_idx ON appointment_services(appointment_id);

-- ---------------------------------------------------------------------------
-- Cola del día
-- ---------------------------------------------------------------------------

CREATE TABLE daily_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  terapeuta_id UUID NOT NULL REFERENCES staff(id),
  sala_id UUID REFERENCES rooms(id),
  fecha DATE NOT NULL,
  hora_cita TIME NOT NULL,
  hora_llegada TIMESTAMPTZ,
  hora_inicio_atencion TIMESTAMPTZ,
  hora_fin_atencion TIMESTAMPTZ,
  estado queue_status NOT NULL DEFAULT 'pendiente',
  prioridad INT NOT NULL DEFAULT 0,
  posicion_cola INT NOT NULL DEFAULT 0,
  notas_recepcion TEXT,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE INDEX daily_queue_clinic_fecha_idx ON daily_queue(clinic_id, fecha, posicion_cola);
CREATE INDEX daily_queue_terapeuta_idx ON daily_queue(terapeuta_id, fecha);

-- ---------------------------------------------------------------------------
-- Pagos (inmutables; reembolsos = nueva fila)
-- ---------------------------------------------------------------------------

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  paciente_id UUID NOT NULL REFERENCES patients(id),
  idempotency_key VARCHAR(64) NOT NULL,
  metodo_pago payment_method NOT NULL,
  monto NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
  monto_recibido NUMERIC(10,2),
  cambio NUMERIC(10,2),
  referencia VARCHAR(255),
  estado payment_status NOT NULL DEFAULT 'pendiente',
  pagado_en_caja BOOLEAN NOT NULL DEFAULT false,
  cajero_id UUID REFERENCES staff(id),
  fecha_pago TIMESTAMPTZ,
  comprobante_path VARCHAR(500),
  payment_ref_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX payments_clinic_idx ON payments(clinic_id, created_at);
CREATE INDEX payments_appointment_idx ON payments(appointment_id);

-- ---------------------------------------------------------------------------
-- Notificaciones in-app mínimas (canales email/SMS en Fase 3)
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role_destino TEXT CHECK (role_destino IS NULL OR role_destino IN ('admin', 'terapeuta', 'recepcionista')),
  staff_id UUID REFERENCES staff(id),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  payload JSONB,
  leida BOOLEAN NOT NULL DEFAULT false,
  leida_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_clinic_created_idx ON notifications(clinic_id, created_at DESC);
CREATE INDEX notifications_staff_unread_idx ON notifications(staff_id, leida) WHERE leida = false;

-- Realtime (ignorar si la publicación no existe en algún entorno)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_queue;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services FORCE ROW LEVEL SECURITY;
ALTER TABLE daily_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- services: lectura staff; escritura admin
CREATE POLICY services_select ON services
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY services_write_admin ON services
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- appointment_services: staff de clínica; terapeuta solo sus citas
CREATE POLICY appointment_services_select ON appointment_services
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.current_staff_role() IN ('admin', 'recepcionista')
      OR terapeuta_id = public.current_staff_id()
      OR EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.id = appointment_id AND a.terapeuta_id = public.current_staff_id()
      )
    )
  );

CREATE POLICY appointment_services_insert ON appointment_services
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
  );

CREATE POLICY appointment_services_delete ON appointment_services
  FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

-- daily_queue
CREATE POLICY daily_queue_select ON daily_queue
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.current_staff_role() IN ('admin', 'recepcionista')
      OR terapeuta_id = public.current_staff_id()
    )
  );

CREATE POLICY daily_queue_insert ON daily_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

CREATE POLICY daily_queue_update ON daily_queue
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.current_staff_role() IN ('admin', 'recepcionista')
      OR terapeuta_id = public.current_staff_id()
    )
  )
  WITH CHECK (clinic_id = public.current_clinic_id());

-- payments: SOLO admin y recepción (terapeuta NO)
CREATE POLICY payments_select ON payments
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

CREATE POLICY payments_insert ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

-- Sin UPDATE/DELETE de pagos (inmutables); reembolso = INSERT
REVOKE UPDATE, DELETE ON payments FROM authenticated;
REVOKE UPDATE, DELETE ON payments FROM anon;

-- notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      staff_id = public.current_staff_id()
      OR (staff_id IS NULL AND (
        role_destino IS NULL OR role_destino = public.current_staff_role()::text
      ))
    )
  );

CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      staff_id = public.current_staff_id()
      OR (staff_id IS NULL AND (
        role_destino IS NULL OR role_destino = public.current_staff_role()::text
      ))
    )
  )
  WITH CHECK (clinic_id = public.current_clinic_id());

-- ---------------------------------------------------------------------------
-- RPCs transaccionales
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_daily_queue(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID := public.current_clinic_id();
  v_count INT := 0;
  r RECORD;
  v_pos INT;
BEGIN
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Sin clínica en sesión';
  END IF;
  IF public.current_staff_role() NOT IN ('admin', 'recepcionista') THEN
    RAISE EXCEPTION 'Sin permiso para sincronizar cola';
  END IF;

  v_pos := COALESCE((
    SELECT MAX(posicion_cola) FROM daily_queue
    WHERE clinic_id = v_clinic AND fecha = p_fecha
  ), 0);

  FOR r IN
    SELECT a.id, a.patient_id, a.terapeuta_id, a.sala_id,
           (a.inicio AT TIME ZONE COALESCE(
             (SELECT timezone FROM clinic_config WHERE clinic_id = v_clinic),
             'America/Managua'
           ))::time AS hora_local,
           a.estado
    FROM appointments a
    WHERE a.clinic_id = v_clinic
      AND (a.inicio AT TIME ZONE COALESCE(
             (SELECT timezone FROM clinic_config WHERE clinic_id = v_clinic),
             'America/Managua'
           ))::date = p_fecha
      AND a.estado NOT IN ('cancelado')
      AND NOT EXISTS (
        SELECT 1 FROM daily_queue dq WHERE dq.appointment_id = a.id
      )
    ORDER BY a.inicio
  LOOP
    v_pos := v_pos + 1;
    INSERT INTO daily_queue (
      clinic_id, appointment_id, patient_id, terapeuta_id, sala_id,
      fecha, hora_cita, estado, posicion_cola
    ) VALUES (
      v_clinic, r.id, r.patient_id, r.terapeuta_id, r.sala_id,
      p_fecha, r.hora_local,
      CASE
        WHEN r.estado::text IN ('en_sala_espera','en_consulta','pendiente_pago','completado','no_asistio')
          THEN r.estado::text::queue_status
        WHEN r.estado = 'confirmada' THEN 'pendiente'::queue_status
        ELSE 'pendiente'::queue_status
      END,
      v_pos
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_queue_estado(
  p_id UUID,
  p_expected_version INT,
  p_nuevo_estado queue_status,
  p_notas TEXT DEFAULT NULL
)
RETURNS daily_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row daily_queue;
  v_from queue_status;
  v_allowed BOOLEAN := false;
BEGIN
  SELECT * INTO v_row FROM daily_queue
  WHERE id = p_id AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cola no encontrada';
  END IF;

  IF v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT';
  END IF;

  IF public.current_staff_role() = 'terapeuta' AND v_row.terapeuta_id <> public.current_staff_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  v_from := v_row.estado;
  v_allowed := CASE
    WHEN v_from = 'pendiente' AND p_nuevo_estado IN ('en_sala_espera','en_consulta','cancelado','no_asistio') THEN true
    WHEN v_from = 'en_sala_espera' AND p_nuevo_estado IN ('en_consulta','cancelado','no_asistio') THEN true
    WHEN v_from = 'en_consulta' AND p_nuevo_estado IN ('pendiente_pago','completado','cancelado') THEN true
    WHEN v_from = 'pendiente_pago' AND p_nuevo_estado IN ('completado','cancelado') THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transición inválida: % → %', v_from, p_nuevo_estado;
  END IF;

  UPDATE daily_queue SET
    estado = p_nuevo_estado,
    version = version + 1,
    updated_at = now(),
    notas_recepcion = COALESCE(p_notas, notas_recepcion),
    hora_llegada = CASE
      WHEN p_nuevo_estado = 'en_sala_espera' AND hora_llegada IS NULL THEN now()
      ELSE hora_llegada END,
    hora_inicio_atencion = CASE
      WHEN p_nuevo_estado = 'en_consulta' AND hora_inicio_atencion IS NULL THEN now()
      ELSE hora_inicio_atencion END,
    hora_fin_atencion = CASE
      WHEN p_nuevo_estado IN ('pendiente_pago','completado') THEN now()
      ELSE hora_fin_atencion END
  WHERE id = p_id
  RETURNING * INTO v_row;

  -- Espejo en appointments
  UPDATE appointments SET
    estado = CASE p_nuevo_estado::text
      WHEN 'en_sala_espera' THEN 'en_sala_espera'::appointment_status
      WHEN 'en_consulta' THEN 'en_consulta'::appointment_status
      WHEN 'pendiente_pago' THEN 'pendiente_pago'::appointment_status
      WHEN 'completado' THEN 'completado'::appointment_status
      WHEN 'cancelado' THEN 'cancelado'::appointment_status
      WHEN 'no_asistio' THEN 'no_asistio'::appointment_status
      ELSE estado
    END,
    updated_at = now()
  WHERE id = v_row.appointment_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_daily_queue(
  p_fecha DATE,
  p_ordered_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID := public.current_clinic_id();
  i INT;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'recepcionista') THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  FOR i IN 1 .. coalesce(array_length(p_ordered_ids, 1), 0) LOOP
    UPDATE daily_queue
       SET posicion_cola = i,
           version = version + 1,
           updated_at = now()
     WHERE id = p_ordered_ids[i]
       AND clinic_id = v_clinic
       AND fecha = p_fecha;
  END LOOP;
END;
$$;

-- Finalizar consulta: aplica servicios (precio congelado) + pendiente_pago
CREATE OR REPLACE FUNCTION public.finalize_consultation(
  p_appointment_id UUID,
  p_queue_id UUID,
  p_expected_version INT,
  p_items JSONB  -- [{service_id, cantidad, notas?}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID := public.current_clinic_id();
  v_staff UUID := public.current_staff_id();
  v_queue daily_queue;
  v_item JSONB;
  v_svc services%ROWTYPE;
  v_total NUMERIC(10,2) := 0;
  v_qty INT;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'terapeuta') THEN
    RAISE EXCEPTION 'Solo terapeuta/admin finaliza consulta';
  END IF;

  SELECT * INTO v_queue FROM daily_queue
  WHERE id = p_queue_id AND clinic_id = v_clinic FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cola no encontrada'; END IF;
  IF v_queue.version <> p_expected_version THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF v_queue.appointment_id <> p_appointment_id THEN RAISE EXCEPTION 'Cita no coincide'; END IF;
  IF v_queue.estado <> 'en_consulta' THEN
    RAISE EXCEPTION 'La cita debe estar en_consulta';
  END IF;

  DELETE FROM appointment_services
  WHERE appointment_id = p_appointment_id AND clinic_id = v_clinic;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_svc FROM services
    WHERE id = (v_item->>'service_id')::uuid
      AND clinic_id = v_clinic
      AND activo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Servicio inválido %', v_item->>'service_id';
    END IF;

    v_qty := COALESCE((v_item->>'cantidad')::int, 1);
    INSERT INTO appointment_services (
      clinic_id, appointment_id, service_id, costo_aplicado, cantidad, terapeuta_id, notas
    ) VALUES (
      v_clinic, p_appointment_id, v_svc.id, v_svc.costo, v_qty, v_staff,
      v_item->>'notas'
    );
    v_total := v_total + (v_svc.costo * v_qty);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Debe aplicar al menos un servicio con costo';
  END IF;

  PERFORM public.update_queue_estado(p_queue_id, p_expected_version, 'pendiente_pago', NULL);

  INSERT INTO notifications (clinic_id, role_destino, tipo, titulo, cuerpo, payload)
  VALUES (
    v_clinic,
    'recepcionista',
    'pago_pendiente',
    'Pago pendiente',
    format('Cobrar $%s', to_char(v_total, 'FM999999990.00')),
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'queue_id', p_queue_id,
      'monto', v_total
    )
  );

  RETURN jsonb_build_object('total', v_total, 'appointment_id', p_appointment_id);
END;
$$;

-- Cobro idempotente + completar cola/cita en una transacción
CREATE OR REPLACE FUNCTION public.register_payment(
  p_appointment_id UUID,
  p_queue_id UUID,
  p_expected_version INT,
  p_idempotency_key TEXT,
  p_metodo payment_method,
  p_monto_recibido NUMERIC DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL,
  p_comprobante_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID := public.current_clinic_id();
  v_cajero UUID := public.current_staff_id();
  v_existing payments%ROWTYPE;
  v_queue daily_queue;
  v_appt appointments%ROWTYPE;
  v_total NUMERIC(10,2);
  v_change NUMERIC(10,2);
  v_payment_id UUID;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'recepcionista') THEN
    RAISE EXCEPTION 'Sin permiso de caja';
  END IF;

  -- Idempotencia: si ya existe la clave, devolver el pago existente
  SELECT * INTO v_existing FROM payments WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'idempotent_replay', true,
      'monto', v_existing.monto,
      'cambio', v_existing.cambio
    );
  END IF;

  SELECT * INTO v_queue FROM daily_queue
  WHERE id = p_queue_id AND clinic_id = v_clinic FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cola no encontrada'; END IF;
  IF v_queue.version <> p_expected_version THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF v_queue.estado <> 'pendiente_pago' THEN
    RAISE EXCEPTION 'La cola no está en pendiente_pago';
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id AND clinic_id = v_clinic;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cita no encontrada'; END IF;

  SELECT COALESCE(SUM(costo_aplicado * cantidad), 0) INTO v_total
  FROM appointment_services
  WHERE appointment_id = p_appointment_id AND clinic_id = v_clinic;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'No hay servicios para cobrar';
  END IF;

  v_change := NULL;
  IF p_metodo = 'cash' THEN
    IF p_monto_recibido IS NULL OR p_monto_recibido < v_total THEN
      RAISE EXCEPTION 'Monto recibido insuficiente';
    END IF;
    v_change := p_monto_recibido - v_total;
  ELSIF p_metodo = 'transferencia' THEN
    IF p_referencia IS NULL OR length(trim(p_referencia)) = 0 THEN
      RAISE EXCEPTION 'Referencia de transferencia requerida';
    END IF;
  END IF;

  INSERT INTO payments (
    clinic_id, appointment_id, paciente_id, idempotency_key, metodo_pago,
    monto, monto_recibido, cambio, referencia, estado, pagado_en_caja,
    cajero_id, fecha_pago, comprobante_path
  ) VALUES (
    v_clinic, p_appointment_id, v_appt.patient_id, p_idempotency_key, p_metodo,
    v_total, p_monto_recibido, v_change, p_referencia, 'pagado', true,
    v_cajero, now(), p_comprobante_path
  ) RETURNING id INTO v_payment_id;

  UPDATE daily_queue SET
    estado = 'completado',
    version = version + 1,
    updated_at = now(),
    hora_fin_atencion = COALESCE(hora_fin_atencion, now())
  WHERE id = p_queue_id AND version = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_CONFLICT';
  END IF;

  UPDATE appointments SET
    estado = 'completado',
    updated_at = now()
  WHERE id = p_appointment_id;

  INSERT INTO notifications (clinic_id, role_destino, tipo, titulo, cuerpo, payload)
  VALUES (
    v_clinic,
    NULL,
    'pago_registrado',
    'Pago registrado',
    format('$%s cobrado', to_char(v_total, 'FM999999990.00')),
    jsonb_build_object('payment_id', v_payment_id, 'appointment_id', p_appointment_id)
  );

  -- Aviso terapeuta disponible si hay siguiente en sala
  INSERT INTO notifications (clinic_id, staff_id, tipo, titulo, cuerpo, payload)
  SELECT v_clinic, v_queue.terapeuta_id, 'terapeuta_disponible',
         'Siguiente paciente',
         'Hay pacientes en sala de espera',
         jsonb_build_object('terapeuta_id', v_queue.terapeuta_id)
  WHERE EXISTS (
    SELECT 1 FROM daily_queue q
    WHERE q.clinic_id = v_clinic
      AND q.fecha = v_queue.fecha
      AND q.terapeuta_id = v_queue.terapeuta_id
      AND q.estado = 'en_sala_espera'
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'idempotent_replay', false,
    'monto', v_total,
    'cambio', v_change
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_daily_queue(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_queue_estado(UUID, INT, queue_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_daily_queue(DATE, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_consultation(UUID, UUID, INT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment(UUID, UUID, INT, TEXT, payment_method, NUMERIC, TEXT, TEXT) TO authenticated;
