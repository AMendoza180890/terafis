-- Perfil de staff: foto, actualización propia sin escalada de privilegios,
-- bucket privado para avatares.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

-- Impide que un usuario no-admin cambie rol, clínica, auth o estado.
CREATE OR REPLACE FUNCTION public.staff_prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_clinic_admin() THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.activo IS DISTINCT FROM OLD.activo
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       OR NEW.comision_porcentaje IS DISTINCT FROM OLD.comision_porcentaje
       OR NEW.mfa_forzar_reinscripcion IS DISTINCT FROM OLD.mfa_forzar_reinscripcion
    THEN
      RAISE EXCEPTION 'No autorizado a modificar privilegios de staff';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_privilege_guard ON staff;
CREATE TRIGGER staff_privilege_guard
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE PROCEDURE public.staff_prevent_privilege_escalation();

-- Storage: avatares de staff (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-avatars',
  'staff-avatars',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS staff_avatars_select ON storage.objects;
CREATE POLICY staff_avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'staff-avatars'
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  );

DROP POLICY IF EXISTS staff_avatars_insert ON storage.objects;
CREATE POLICY staff_avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'staff-avatars'
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text
    AND (storage.foldername(name))[2] = public.current_staff_id()::text
  );

DROP POLICY IF EXISTS staff_avatars_update ON storage.objects;
CREATE POLICY staff_avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'staff-avatars'
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text
    AND (storage.foldername(name))[2] = public.current_staff_id()::text
  )
  WITH CHECK (
    bucket_id = 'staff-avatars'
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text
    AND (storage.foldername(name))[2] = public.current_staff_id()::text
  );

DROP POLICY IF EXISTS staff_avatars_delete ON storage.objects;
CREATE POLICY staff_avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'staff-avatars'
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text
    AND (storage.foldername(name))[2] = public.current_staff_id()::text
  );
