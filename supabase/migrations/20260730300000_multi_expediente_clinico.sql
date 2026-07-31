-- Múltiples expedientes clínicos por paciente + vínculo a seguimientos.

ALTER TABLE patient_clinical
  DROP CONSTRAINT IF EXISTS patient_clinical_patient_id_key;

ALTER TABLE patient_clinical
  ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT 'Expediente clínico',
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'cerrado')),
  ADD COLUMN IF NOT EXISTS fecha_apertura DATE NOT NULL DEFAULT (CURRENT_DATE),
  ADD COLUMN IF NOT EXISTS fecha_cierre DATE;

COMMENT ON COLUMN patient_clinical.titulo IS 'Motivo / título del episodio clínico';
COMMENT ON COLUMN patient_clinical.estado IS 'activo | cerrado';

CREATE INDEX IF NOT EXISTS idx_patient_clinical_patient_estado
  ON patient_clinical (patient_id, estado);

-- Vincular seguimientos al expediente.
ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS clinical_id UUID REFERENCES patient_clinical(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_notes_clinical
  ON session_notes (clinical_id, created_at DESC);

-- Backfill: asociar notas al único expediente existente del paciente.
UPDATE session_notes sn
SET clinical_id = pc.id
FROM patient_clinical pc
WHERE sn.clinical_id IS NULL
  AND pc.patient_id = sn.patient_id;
