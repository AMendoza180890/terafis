-- Recepción puede gestionar el catálogo de servicios (crear/editar/activar).
DROP POLICY IF EXISTS services_write_admin ON services;

CREATE POLICY services_write_admin_recepcion ON services
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );
