-- Bootstrap del primer admin (ejecutar en Supabase → SQL Editor).
-- Prerrequisito: el usuario ya existe en Authentication con este UID.
-- La contraseña NO se define aquí: vive en Supabase Auth (la que pusiste al crear el user,
-- o la que restablezcas en Authentication → Users → Reset password).

-- Auth user (ya creado por ti):
--   UID:   72c19433-8fef-43dd-a9e8-f7f2a6ac3dbd
--   Email: clinicterafis@gmail.com

BEGIN;

WITH nueva_clinica AS (
  INSERT INTO clinics (nombre, activa)
  VALUES ('Terafis', true)
  RETURNING id
),
cfg AS (
  INSERT INTO clinic_config (clinic_id, timezone, tema_defecto)
  SELECT id, 'America/Managua', 'sistema'
  FROM nueva_clinica
  RETURNING clinic_id
)
INSERT INTO staff (
  clinic_id,
  auth_user_id,
  nombre,
  email,
  rol,
  activo,
  tema_preferido
)
SELECT
  clinic_id,
  '72c19433-8fef-43dd-a9e8-f7f2a6ac3dbd'::uuid,
  'Admin Terafis',
  'clinicterafis@gmail.com',
  'admin'::staff_role,
  true,
  'sistema'
FROM cfg
ON CONFLICT (auth_user_id) DO UPDATE
SET
  email = EXCLUDED.email,
  nombre = EXCLUDED.nombre,
  rol = EXCLUDED.rol,
  activo = true,
  deleted_at = NULL,
  updated_at = now();

COMMIT;

-- Verificación rápida:
SELECT s.id, s.email, s.rol, s.activo, c.nombre AS clinica
FROM staff s
JOIN clinics c ON c.id = s.clinic_id
WHERE s.auth_user_id = '72c19433-8fef-43dd-a9e8-f7f2a6ac3dbd';
