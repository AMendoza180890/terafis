-- Permisos de menú por rol y overrides por usuario (admin gestiona).

CREATE TABLE role_menu_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  rol staff_role NOT NULL,
  menu_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, rol, menu_key)
);

CREATE INDEX role_menu_permissions_clinic_idx ON role_menu_permissions(clinic_id);

CREATE TABLE staff_menu_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, staff_id, menu_key)
);

CREATE INDEX staff_menu_overrides_staff_idx ON staff_menu_permission_overrides(staff_id);

ALTER TABLE role_menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_menu_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE staff_menu_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_menu_permission_overrides FORCE ROW LEVEL SECURITY;

-- Lectura: staff de la clínica (para resolver menú efectivo).
CREATE POLICY role_menu_permissions_select ON role_menu_permissions
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY staff_menu_overrides_select ON staff_menu_permission_overrides
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR staff_id = public.current_staff_id()
    )
  );

-- Escritura: solo admin.
CREATE POLICY role_menu_permissions_write ON role_menu_permissions
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY staff_menu_overrides_write ON staff_menu_permission_overrides
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- Seed defaults actuales por clínica existente.
DO $$
DECLARE
  c RECORD;
  keys TEXT[] := ARRAY[
    'inicio','pacientes','doctores','agenda','cola','servicios',
    'caja','inventario','reportes','planes','staff','auditoria',
    'configuracion','permisos'
  ];
  k TEXT;
  admin_deny TEXT[] := ARRAY[]::TEXT[];
  recep_deny TEXT[] := ARRAY['planes','staff','auditoria','permisos'];
  fisio_deny TEXT[] := ARRAY[
    'doctores','caja','inventario','reportes','planes','staff','auditoria','permisos'
  ];
BEGIN
  FOR c IN SELECT id FROM clinics LOOP
    FOREACH k IN ARRAY keys LOOP
      INSERT INTO role_menu_permissions (clinic_id, rol, menu_key, allowed)
      VALUES (c.id, 'admin', k, NOT (k = ANY (admin_deny)))
      ON CONFLICT (clinic_id, rol, menu_key) DO NOTHING;

      INSERT INTO role_menu_permissions (clinic_id, rol, menu_key, allowed)
      VALUES (c.id, 'recepcionista', k, NOT (k = ANY (recep_deny)))
      ON CONFLICT (clinic_id, rol, menu_key) DO NOTHING;

      INSERT INTO role_menu_permissions (clinic_id, rol, menu_key, allowed)
      VALUES (c.id, 'terapeuta', k, NOT (k = ANY (fisio_deny)))
      ON CONFLICT (clinic_id, rol, menu_key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
