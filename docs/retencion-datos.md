# Decisión de retención de datos clínicos — Fase 0 (§3 del plan)

#

# ESTADO: PROVISIONAL — requiere confirmación con asesoría legal antes de

# poner datos reales de pacientes en producción.

#

# Conflicto identificado:

# - NOM-004-SSA3-2012 (y normas asociadas de expediente clínico en México)

# imponen un periodo mínimo de conservación del expediente.

# - LFPDPPP otorga al titular derechos ARCO, incluyendo cancelación.

#

# Decisión provisional de ingeniería (hasta asesoría legal):

#

# 1. Jurisdicción operativa asumida: México (LFPDPPP). Si hay pacientes UE,

# se evaluará GDPR además.

# 2. Durante el periodo de conservación obligatorio (por defecto 5 años,

# configurable en clinic_config.retencion_expedientes_anios):

# - Borrado lógico (deleted_at) ante solicitudes de cancelación.

# - El expediente permanece inaccesible en UI operativa pero retenido

# para cumplimiento normativo.

# 3. Al vencer el plazo: job programado de borrado físico o anonimización

# (opción intermedia para estadísticas disociadas).

# 4. Consentimiento informado y aviso de privacidad: versionados

# (version_documento, fecha_aceptacion, ip, hash del texto).

# 5. Procedimiento ARCO: exportación + rectificación documentados en Fase 1+.

#

# ACCIÓN REQUERIDA DEL PRODUCT OWNER:

# Confirmar con abogado/asesor en privacidad y salud qué régimen prevalece

# para fisioterapia en la jurisdicción de operación, y actualizar este

# archivo + clinic_config.retencion_expedientes_anios antes del go-live.
