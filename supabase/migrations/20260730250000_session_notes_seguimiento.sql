-- Seguimiento clínico: tratamiento/observaciones + acceso por cola del día

ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS tratamiento TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

COMMENT ON COLUMN session_notes.tratamiento IS 'Tratamiento aplicado (cifrado en app)';
COMMENT ON COLUMN session_notes.observaciones IS 'Observaciones de sesión (cifrado en app)';

-- Terapeuta con cita histórica O paciente en cola de hoy asignado a él.
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
    )
    OR EXISTS (
      SELECT 1
      FROM daily_queue q
      WHERE q.patient_id = p_patient_id
        AND q.clinic_id = public.current_clinic_id()
        AND q.terapeuta_id = public.current_staff_id()
        AND q.fecha = (timezone('utc', now()))::date
        AND q.estado NOT IN ('cancelado', 'no_asistio')
    );
$$;

COMMENT ON FUNCTION public.staff_has_patient_access(UUID) IS
  'Admin o terapeuta con cita no cancelada o turno en cola del día para el paciente.';
