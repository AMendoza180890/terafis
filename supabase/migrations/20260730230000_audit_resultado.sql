-- Extiende audit_log con resultado (éxito/error/info) y mensaje legible.
-- Append-only se mantiene; sin UPDATE/DELETE.

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS resultado TEXT NOT NULL DEFAULT 'exito'
    CHECK (resultado IN ('exito', 'error', 'info'));

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS mensaje TEXT;

CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx
  ON audit_log (clinic_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_resultado_created_idx
  ON audit_log (clinic_id, resultado, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_accion_created_idx
  ON audit_log (clinic_id, accion, created_at DESC);
