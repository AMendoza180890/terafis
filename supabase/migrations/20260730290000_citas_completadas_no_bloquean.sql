-- Las citas completadas no deben bloquear nuevos turnos del mismo horario.
-- Antes solo se excluían cancelado/no_asistio del EXCLUDE de solapamiento.

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_solapamiento_terapeuta;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_solapamiento_sala;

ALTER TABLE appointments ADD CONSTRAINT no_solapamiento_terapeuta
  EXCLUDE USING gist (
    terapeuta_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado NOT IN ('cancelado', 'no_asistio', 'completado'));

ALTER TABLE appointments ADD CONSTRAINT no_solapamiento_sala
  EXCLUDE USING gist (
    sala_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (sala_id IS NOT NULL AND estado NOT IN ('cancelado', 'no_asistio', 'completado'));
