-- Asegura que recepción VEA el expediente clínico y el historial de seguimiento
-- que registra el fisioterapeuta. Escritura de session_notes sigue en fisio/admin.

-- ---------------------------------------------------------------------------
-- patient_clinical: lectura/escritura recepción
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS patient_clinical_select ON patient_clinical;
DROP POLICY IF EXISTS patient_clinical_insert ON patient_clinical;
DROP POLICY IF EXISTS patient_clinical_update ON patient_clinical;

CREATE POLICY patient_clinical_select ON patient_clinical
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
    AND (
      public.current_staff_role() = 'recepcionista'
      OR public.is_clinic_admin()
      OR public.staff_has_patient_access(patient_id)
    )
  );

CREATE POLICY patient_clinical_insert ON patient_clinical
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
    AND (
      public.current_staff_role() = 'recepcionista'
      OR public.is_clinic_admin()
      OR public.staff_has_patient_access(patient_id)
    )
  );

CREATE POLICY patient_clinical_update ON patient_clinical
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
    AND (
      public.current_staff_role() = 'recepcionista'
      OR public.is_clinic_admin()
      OR public.staff_has_patient_access(patient_id)
    )
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
  );

-- ---------------------------------------------------------------------------
-- session_notes: recepción SOLO lectura (historial del fisio)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS session_notes_select ON session_notes;

CREATE POLICY session_notes_select ON session_notes
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

COMMENT ON TABLE patient_clinical IS
  'Expediente clínico. Visible para admin, terapeuta (con acceso) y recepcionista.';
