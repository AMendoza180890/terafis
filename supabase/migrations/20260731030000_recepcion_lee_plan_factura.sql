-- Recepción puede leer plan clínico para imprimir factura de la atención.
-- (Antes solo admin/terapeuta veían versiones y ejercicios.)

DROP POLICY IF EXISTS tpv_select ON treatment_plan_versions;
CREATE POLICY tpv_select ON treatment_plan_versions
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
    AND EXISTS (
      SELECT 1 FROM treatment_plans p
      WHERE p.id = plan_id
        AND p.clinic_id = public.current_clinic_id()
        AND (
          public.is_clinic_admin()
          OR public.current_staff_role() = 'recepcionista'
          OR public.staff_has_patient_access(p.patient_id)
        )
    )
  );

DROP POLICY IF EXISTS tex_select ON treatment_exercises;
CREATE POLICY tex_select ON treatment_exercises
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
  );

DROP POLICY IF EXISTS tprog_select ON treatment_progress;
CREATE POLICY tprog_select ON treatment_progress
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'terapeuta', 'recepcionista')
  );

-- Terapeuta/admin siguen escribiendo progreso; recepción solo lee.
DROP POLICY IF EXISTS tprog_write ON treatment_progress;
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

COMMENT ON POLICY tpv_select ON treatment_plan_versions IS
  'Admin/terapeuta clínicos; recepción lectura para factura/comprobante.';
