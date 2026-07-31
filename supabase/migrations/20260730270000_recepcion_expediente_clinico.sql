-- Recepción puede leer y actualizar el expediente clínico (patient_clinical).
-- Seguimiento (session_notes) y planes terapéuticos siguen restringidos a terapeuta/admin.

DROP POLICY IF EXISTS patient_clinical_select ON patient_clinical;
DROP POLICY IF EXISTS patient_clinical_insert ON patient_clinical;
DROP POLICY IF EXISTS patient_clinical_update ON patient_clinical;

CREATE POLICY patient_clinical_select ON patient_clinical
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      (
        public.current_staff_role() IN ('admin', 'terapeuta')
        AND public.staff_has_patient_access(patient_id)
      )
      OR public.current_staff_role() = 'recepcionista'
    )
  );

CREATE POLICY patient_clinical_insert ON patient_clinical
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND (
      (
        public.current_staff_role() IN ('admin', 'terapeuta')
        AND (
          public.is_clinic_admin()
          OR public.staff_has_patient_access(patient_id)
        )
      )
      OR public.current_staff_role() = 'recepcionista'
    )
  );

CREATE POLICY patient_clinical_update ON patient_clinical
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      (
        public.current_staff_role() IN ('admin', 'terapeuta')
        AND public.staff_has_patient_access(patient_id)
      )
      OR public.current_staff_role() = 'recepcionista'
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
  );

COMMENT ON TABLE patient_clinical IS
  'Expediente clínico cifrado en app. Acceso: admin, terapeuta (con acceso al paciente) y recepcionista.';
