-- Fase 0 — Cimientos
-- Multi-tenant + RLS + helpers de auth + audit_log append-only
-- Nunca crear tabla de negocio sin ENABLE/FORCE RLS en la misma migración.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (TEXT + CHECK preferido para tema; enums nativos para roles fijos)
-- ---------------------------------------------------------------------------

CREATE TYPE staff_role AS ENUM ('admin', 'terapeuta', 'recepcionista');

-- ---------------------------------------------------------------------------
-- Tablas base
-- ---------------------------------------------------------------------------

CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clinic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
  direccion TEXT,
  telefono TEXT,
  rfc TEXT,
  logo_path TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Managua',
  tema_defecto TEXT NOT NULL DEFAULT 'sistema'
    CHECK (tema_defecto IN ('claro', 'oscuro', 'sistema')),
  auto_logout_recepcion_min INT NOT NULL DEFAULT 15,
  auto_logout_staff_min INT NOT NULL DEFAULT 30,
  mfa_obligatorio_admin BOOLEAN NOT NULL DEFAULT true,
  mfa_obligatorio_terapeuta BOOLEAN NOT NULL DEFAULT true,
  mfa_obligatorio_recepcion BOOLEAN NOT NULL DEFAULT false,
  retencion_expedientes_anios INT NOT NULL DEFAULT 5,
  ultima_prueba_restauracion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  rol staff_role NOT NULL,
  especialidad TEXT,
  cedula_profesional TEXT,
  tema_preferido TEXT NOT NULL DEFAULT 'sistema'
    CHECK (tema_preferido IN ('claro', 'oscuro', 'sistema')),
  mfa_habilitado BOOLEAN NOT NULL DEFAULT false,
  mfa_forzar_reinscripcion BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX staff_clinic_id_idx ON staff(clinic_id);
CREATE INDEX staff_clinic_rol_idx ON staff(clinic_id, rol);

CREATE TABLE staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  ultimo_acceso_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  revocada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX staff_sessions_clinic_id_idx ON staff_sessions(clinic_id);
CREATE INDEX staff_sessions_staff_id_idx ON staff_sessions(staff_id);
CREATE INDEX staff_sessions_token_hash_idx ON staff_sessions(refresh_token_hash);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  actor_id UUID,
  rol TEXT,
  accion TEXT NOT NULL,
  tabla TEXT,
  registro_id UUID,
  ip TEXT,
  user_agent TEXT,
  diff JSONB,
  hash_anterior TEXT NOT NULL,
  hash_actual TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_clinic_created_idx ON audit_log(clinic_id, created_at);
CREATE INDEX audit_log_tabla_registro_idx ON audit_log(tabla, registro_id);

-- ---------------------------------------------------------------------------
-- Helpers RLS (security definer, búsqueda acotada)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM staff
  WHERE auth_user_id = auth.uid()
    AND deleted_at IS NULL
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM staff
  WHERE auth_user_id = auth.uid()
    AND deleted_at IS NULL
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM staff
  WHERE auth_user_id = auth.uid()
    AND deleted_at IS NULL
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE auth_user_id = auth.uid()
      AND deleted_at IS NULL
      AND activo = true
      AND rol = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: activar + forzar en todas las tablas
-- ---------------------------------------------------------------------------

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics FORCE ROW LEVEL SECURITY;

ALTER TABLE clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_config FORCE ROW LEVEL SECURITY;

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;

ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- clinics
CREATE POLICY clinics_select_own ON clinics
  FOR SELECT TO authenticated
  USING (id = public.current_clinic_id());

CREATE POLICY clinics_update_admin ON clinics
  FOR UPDATE TO authenticated
  USING (id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (id = public.current_clinic_id() AND public.is_clinic_admin());

-- clinic_config
CREATE POLICY clinic_config_select_own ON clinic_config
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY clinic_config_update_admin ON clinic_config
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY clinic_config_insert_admin ON clinic_config
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- staff: todos ven staff de su clínica; solo admin modifica
CREATE POLICY staff_select_own_clinic ON staff
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() AND deleted_at IS NULL);

CREATE POLICY staff_insert_admin ON staff
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY staff_update_admin ON staff
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- El propio usuario puede actualizar su tema_preferido (vía función o política estrecha)
CREATE POLICY staff_update_own_theme ON staff
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- staff_sessions
CREATE POLICY staff_sessions_select ON staff_sessions
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND (
      public.is_clinic_admin()
      OR staff_id = public.current_staff_id()
    )
  );

CREATE POLICY staff_sessions_insert_own ON staff_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND staff_id = public.current_staff_id()
  );

CREATE POLICY staff_sessions_update_revoke ON staff_sessions
  FOR UPDATE TO authenticated
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

-- audit_log: solo INSERT (append-only). SELECT para admin. Sin UPDATE/DELETE.
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY audit_log_insert_authenticated ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id());

-- Revocar UPDATE/DELETE a nivel de privilegios (defensa en profundidad)
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM anon;

-- Service role (bypass RLS) se usa solo en jobs de servidor / Edge Functions.
