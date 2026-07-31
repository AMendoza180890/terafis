-- Doctores que refieren pacientes a la clínica + vínculo en patients

CREATE TABLE referring_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  especialidad TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX referring_doctors_clinic_idx ON referring_doctors(clinic_id);
CREATE INDEX referring_doctors_clinic_nombre_idx
  ON referring_doctors(clinic_id, apellido, nombre);

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS referido_doctor_id UUID
    REFERENCES referring_doctors(id) ON DELETE SET NULL;

CREATE INDEX patients_referido_doctor_idx ON patients(referido_doctor_id);

ALTER TABLE referring_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE referring_doctors FORCE ROW LEVEL SECURITY;

-- Lectura: todo el staff de la clínica (fisio ve el referido en ficha)
CREATE POLICY referring_doctors_select ON referring_doctors
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (deleted_at IS NULL OR public.is_clinic_admin())
  );

-- Alta/edición: recepción y admin
CREATE POLICY referring_doctors_insert ON referring_doctors
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

CREATE POLICY referring_doctors_update ON referring_doctors
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

COMMENT ON TABLE referring_doctors IS
  'Médicos externos que refieren pacientes a la clínica.';
COMMENT ON COLUMN patients.referido_doctor_id IS
  'Doctor que refirió al paciente (opcional).';
