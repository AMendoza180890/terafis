-- Fase 1 — Núcleo operativo
-- Pacientes, salas, agenda (sin solapamiento), horarios de staff.
-- Toda tabla nace con ENABLE + FORCE RLS.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE appointment_status AS ENUM (
  'pendiente',
  'confirmada',
  'en_sala_espera',
  'en_consulta',
  'pendiente_pago',
  'completado',
  'cancelado',
  'no_asistio'
);

-- ---------------------------------------------------------------------------
-- Salas
-- ---------------------------------------------------------------------------

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  equipamiento TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, nombre)
);

CREATE INDEX rooms_clinic_id_idx ON rooms(clinic_id);

-- ---------------------------------------------------------------------------
-- Pacientes (contacto / administrativo)
-- ---------------------------------------------------------------------------

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  fecha_nacimiento DATE,
  contacto_emergencia_nombre TEXT,
  contacto_emergencia_telefono TEXT,
  ocupacion TEXT,
  opt_in_email BOOLEAN NOT NULL DEFAULT false,
  opt_in_sms BOOLEAN NOT NULL DEFAULT false,
  opt_in_whatsapp BOOLEAN NOT NULL DEFAULT false,
  opt_in_push BOOLEAN NOT NULL DEFAULT false,
  opt_in_origen TEXT,
  opt_in_en TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patients_clinic_id_idx ON patients(clinic_id);
CREATE INDEX patients_clinic_nombre_idx ON patients(clinic_id, nombre);
CREATE INDEX patients_clinic_telefono_idx ON patients(clinic_id, telefono);

-- ---------------------------------------------------------------------------
-- Expediente clínico cifrado (capa app AES-256-GCM). Sin acceso recepción.
-- ---------------------------------------------------------------------------

CREATE TABLE patient_clinical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  historial_medico TEXT,
  alergias TEXT,
  medicamentos TEXT,
  diagnosticos_previos TEXT,
  anamnesis TEXT,
  exploracion_fisica TEXT,
  diagnostico_fisioterapeutico TEXT,
  objetivo_tratamiento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_clinical_clinic_id_idx ON patient_clinical(clinic_id);

-- ---------------------------------------------------------------------------
-- Consentimientos versionados (§3)
-- ---------------------------------------------------------------------------

CREATE TABLE patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('aviso_privacidad', 'consentimiento_informado')),
  version_documento TEXT NOT NULL,
  texto_hash TEXT NOT NULL,
  fecha_aceptacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_consents_patient_idx ON patient_consents(patient_id);

-- ---------------------------------------------------------------------------
-- Notas de evolución por sesión (campos clínicos cifrados)
-- ---------------------------------------------------------------------------

CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID,
  terapeuta_id UUID NOT NULL REFERENCES staff(id),
  notas_evolucion TEXT,
  dolor_eva SMALLINT CHECK (dolor_eva IS NULL OR (dolor_eva >= 0 AND dolor_eva <= 10)),
  rango_movimiento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX session_notes_patient_idx ON session_notes(patient_id);
CREATE INDEX session_notes_clinic_idx ON session_notes(clinic_id);

-- ---------------------------------------------------------------------------
-- Horario laboral del staff
-- ---------------------------------------------------------------------------

CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio),
  UNIQUE (staff_id, dia_semana, hora_inicio)
);

CREATE INDEX staff_schedules_clinic_idx ON staff_schedules(clinic_id);

CREATE TABLE staff_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

CREATE INDEX staff_time_off_staff_idx ON staff_time_off(staff_id, inicio, fin);

-- ---------------------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------------------

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  terapeuta_id UUID NOT NULL REFERENCES staff(id),
  sala_id UUID REFERENCES rooms(id),
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  estado appointment_status NOT NULL DEFAULT 'pendiente',
  tipo_servicio TEXT,
  notas_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

CREATE INDEX appointments_clinic_inicio_idx ON appointments(clinic_id, inicio);
CREATE INDEX appointments_terapeuta_idx ON appointments(terapeuta_id, inicio);
CREATE INDEX appointments_patient_idx ON appointments(patient_id, inicio);

-- Sin doble reserva (terapeuta / sala), excluyendo cancelado y no_asistio
ALTER TABLE appointments ADD CONSTRAINT no_solapamiento_terapeuta
  EXCLUDE USING gist (
    terapeuta_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado NOT IN ('cancelado', 'no_asistio'));

ALTER TABLE appointments ADD CONSTRAINT no_solapamiento_sala
  EXCLUDE USING gist (
    sala_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (sala_id IS NOT NULL AND estado NOT IN ('cancelado', 'no_asistio'));

-- FK diferida de session_notes → appointments
ALTER TABLE session_notes
  ADD CONSTRAINT session_notes_appointment_fk
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- Comisiones por staff (módulo staff §6)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS comision_porcentaje NUMERIC(5,2)
    CHECK (comision_porcentaje IS NULL OR (comision_porcentaje >= 0 AND comision_porcentaje <= 100));

-- ---------------------------------------------------------------------------
-- Helpers de acceso clínico
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_has_patient_access(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_clinic_admin()
    OR EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.patient_id = p_patient_id
        AND a.clinic_id = public.current_clinic_id()
        AND a.terapeuta_id = public.current_staff_id()
        AND a.estado NOT IN ('cancelado')
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

ALTER TABLE patient_clinical ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_clinical FORCE ROW LEVEL SECURITY;

ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents FORCE ROW LEVEL SECURITY;

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules FORCE ROW LEVEL SECURITY;

ALTER TABLE staff_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_time_off FORCE ROW LEVEL SECURITY;

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

-- rooms: lectura clínica; escritura admin
CREATE POLICY rooms_select ON rooms
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY rooms_write_admin ON rooms
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- patients: staff de la clínica (contacto). Soft-delete visible solo admin.
CREATE POLICY patients_select ON patients
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (deleted_at IS NULL OR public.is_clinic_admin())
  );

CREATE POLICY patients_insert ON patients
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY patients_update ON patients
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

-- patient_clinical: solo admin o terapeuta con acceso al paciente. NUNCA recepción.
CREATE POLICY patient_clinical_select ON patient_clinical
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND public.staff_has_patient_access(patient_id)
  );

CREATE POLICY patient_clinical_insert ON patient_clinical
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND (
      public.is_clinic_admin()
      OR public.staff_has_patient_access(patient_id)
    )
  );

CREATE POLICY patient_clinical_update ON patient_clinical
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND public.staff_has_patient_access(patient_id)
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

-- Consents: lectura staff; escritura recepción/admin
CREATE POLICY patient_consents_select ON patient_consents
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY patient_consents_insert ON patient_consents
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista', 'terapeuta')
  );

-- session_notes: mismo criterio clínico
CREATE POLICY session_notes_select ON session_notes
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND public.staff_has_patient_access(patient_id)
  );

CREATE POLICY session_notes_write ON session_notes
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
    AND (
      public.is_clinic_admin()
      OR terapeuta_id = public.current_staff_id()
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta')
  );

-- schedules / time off
CREATE POLICY staff_schedules_select ON staff_schedules
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY staff_schedules_write ON staff_schedules
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR staff_id = public.current_staff_id()
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR staff_id = public.current_staff_id()
    )
  );

CREATE POLICY staff_time_off_select ON staff_time_off
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY staff_time_off_write ON staff_time_off
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR staff_id = public.current_staff_id()
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR staff_id = public.current_staff_id()
    )
  );

-- appointments
-- admin/recepción: toda la clínica
-- terapeuta: solo las suyas
CREATE POLICY appointments_select ON appointments
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.current_staff_role() IN ('admin', 'recepcionista')
      OR terapeuta_id = public.current_staff_id()
    )
  );

CREATE POLICY appointments_insert ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista', 'terapeuta')
  );

CREATE POLICY appointments_update ON appointments
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.current_staff_role() IN ('admin', 'recepcionista')
      OR terapeuta_id = public.current_staff_id()
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND (
      public.current_staff_role() IN ('admin', 'recepcionista')
      OR terapeuta_id = public.current_staff_id()
    )
  );
