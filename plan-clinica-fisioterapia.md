# Plan de Desarrollo: Sistema de Gestión para Clínica de Fisioterapia

> **Documento de instrucciones para Claude Code.**
> Este archivo es la fuente de verdad del proyecto. Antes de escribir código, lee el documento completo.
> Trabaja **fase por fase** (ver §16). No implementes módulos de fases posteriores hasta que la fase actual esté completa y probada.
> Todo el código en **TypeScript strict mode**. Interfaz de usuario en **español**. Comentarios de código en español.

---

## 0. Contexto y principios rectores

El sistema maneja **datos personales sensibles de salud** (expedientes clínicos) y **dinero en efectivo**. Estas dos características gobiernan todas las decisiones técnicas:

1. **Defensa en profundidad**: la seguridad nunca depende de una sola capa. La validación en la API **no sustituye** a las políticas RLS en la base de datos.
2. **Menor privilegio por defecto**: toda tabla nace con RLS activado y sin políticas. Se abren accesos explícitamente, nunca al revés.
3. **Auditabilidad**: toda lectura o modificación de un expediente clínico deja rastro inmutable.
4. **Multi-tenant desde el día 1**: aunque hoy sea una sola clínica, el esquema incluye `clinic_id` en todas las tablas de negocio.
5. **UTC internamente, zona local solo en UI**: todas las marcas de tiempo son `TIMESTAMPTZ`.
6. **Idempotencia en operaciones de dinero y de estado**: ninguna acción crítica puede duplicarse por doble clic o reintento de red.

---

## 1. Stack Tecnológico

### Stack seleccionado

| Capa | Tecnología | Notas |
|---|---|---|
| **Frontend** | Next.js (App Router) + React + TypeScript strict + Tailwind CSS | Next.js sobre Astro por la alta interactividad (kanban con drag & drop, tiempo real) |
| **Backend / BD** | **Supabase**: PostgreSQL + RLS + Auth + Storage + Realtime + Edge Functions | Reduce superficie operativa: sin Redis propio ni servidor de sockets propio |
| **ORM / acceso a datos** | **Prisma** para migraciones y tipado; cliente `supabase-js` para RLS, Auth, Storage y Realtime | **No usar TypeORM.** Prisma da mejor DX con TS strict y migraciones predecibles |
| **Tiempo real** | Supabase Realtime (`postgres_changes`) sobre `daily_queue` y `notifications` | Ver §9 para el criterio de cuándo escalar a un servicio de sockets dedicado |
| **Autenticación** | Supabase Auth (`auth.uid()` integrado con RLS) + MFA obligatorio para `admin` y `terapeuta` | |
| **Tareas programadas / colas** | Supabase Edge Functions + `pg_cron` | Recordatorios, cortes de caja, regeneración de cola diaria |
| **Envío de email** | Resend (plantillas HTML) | |
| **SMS / WhatsApp** | Twilio | |
| **Calendario UI** | FullCalendar.io | |
| **Validación** | Zod en cliente y servidor (mismo esquema compartido) | |
| **Gráficas** | Chart.js | |
| **Hosting** | Vercel (frontend + rutas API) + Supabase (BD, auth, storage) | |
| **Secretos** | Vercel Environment Variables + Supabase Vault. **Nunca `.env` en el repo** | |

### Alternativa considerada y descartada (documentar la decisión)

El plan original proponía Node/Express o NestJS + PostgreSQL + Redis + Socket.io + Bull. Es una arquitectura válida y da control más fino sobre eventos y salas de sockets. Se descarta como opción por defecto porque:
- Obliga a operar tres servicios adicionales (Redis, servidor de sockets, backend) para un equipo pequeño.
- Implementar el control de acceso por rol a mano en la API deja la BD sin última línea de defensa, justo en un sistema con datos de salud.

**Punto de reevaluación**: si la lógica de eventos de la cola de atención (§7) llega a requerir salas por rol muy específicas, difusión selectiva o presencia avanzada, se puede añadir un microservicio de Socket.io **solo para la cola**, manteniendo Supabase como fuente de datos y auth. No migrar todo el sistema por ese motivo.

---

## 2. Seguridad (bloque obligatorio, se implementa en Fase 1)

> Esta sección no es opcional ni "para después". Se implementa junto con el primer módulo.

### 2.1 Cifrado de datos sensibles

- El cifrado de disco / TDE del proveedor **no es suficiente**: no protege ante un volcado de la base de datos ni ante acceso con credenciales de administrador de BD.
- **Cifrado a nivel de columna** para campos clínicos sensibles:
  - `patients.historial_medico`
  - `patients.alergias`
  - `patients.medicamentos`
  - `patients.diagnosticos_previos`
  - `clinical_records.*` (notas de evolución, anamnesis, exploración física, diagnóstico fisioterapéutico)
- Implementación: cifrar en la **capa de aplicación** (AES-256-GCM) antes del `INSERT`, con la llave gestionada en Supabase Vault / variables de entorno del servidor. Alternativa aceptable: `pgcrypto` con la llave fuera de la BD.
- Los campos cifrados **no son buscables** por texto. Si se requiere búsqueda, mantener un índice separado sobre un hash determinístico (HMAC con sal fija del tenant) solo para igualdad exacta — nunca sobre el texto en claro.

### 2.2 RLS en PostgreSQL (no solo lógica de API)

Toda tabla de negocio se crea con:

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabla> FORCE ROW LEVEL SECURITY;
```

Políticas mínimas requeridas:

| Rol | Alcance |
|---|---|
| `admin` | Todo dentro de su `clinic_id` |
| `terapeuta` | Solo pacientes con cita asignada a él, dentro de su `clinic_id`. Sin acceso a pagos ni a expedientes de otros terapeutas |
| `recepcionista` | Cola del día, agenda, pagos y datos de contacto del paciente. **Sin acceso al contenido clínico** (historial, notas de evolución, diagnósticos) |

- Al crear vistas, declarar siempre `WITH (security_invoker = on)` para que hereden el RLS de las tablas base y no lo eludan.
- Escribir **pruebas de RLS**: un test por rol que verifique que ve exactamente lo que debe y nada más.

### 2.3 Archivos y documentos

- Documentos clínicos adjuntos (recetas, estudios de imagen, consentimientos) y `comprobante_url` de pagos van en **Supabase Storage con bucket privado**.
- Nunca almacenar ni exponer URLs públicas persistentes. Generar **signed URLs de vida corta (5–15 min)** en cada solicitud.
- Validar tipo MIME y tamaño en el servidor. Rechazar ejecutables y SVG.

### 2.4 Tokens de confirmación / cancelación de cita

- El diseño original (JWT solo con expiración) es insuficiente: un link reenviado o interceptado sigue siendo válido hasta expirar.
- Requisitos:
  - Token **de un solo uso**: tabla `appointment_action_tokens` con `usado_en TIMESTAMPTZ`, marcado dentro de la misma transacción que aplica la acción.
  - Token **opaco y aleatorio** (`crypto.randomBytes(32)`), almacenado **hasheado** (SHA-256) en BD. No un JWT con datos del paciente en el payload.
  - Expiración corta (hasta la hora de la cita, máximo 48 h).
  - Un token por acción: confirmar, cancelar y reagendar son tokens distintos.
  - `POST` para ejecutar la acción, no `GET` — evita que un prefetch del cliente de correo cancele la cita sola. El link abre una página de confirmación con botón.

### 2.5 Sesiones y autenticación

- **MFA obligatorio** para `admin` y `terapeuta` (acceso a expedientes clínicos). Recomendado para `recepcionista`.
- **Rotación de refresh tokens** con detección de reuso: si un refresh token ya usado se presenta de nuevo, revocar toda la familia de sesiones de ese usuario.
- **Revocación de sesión**: tabla de sesiones activas + pantalla en admin para cerrar sesiones de un dispositivo perdido.
- **Auto-logout por inactividad**: 15 min para recepción (terminal compartida), 30 min para terapeuta y admin. Aviso 60 s antes.
- Política de contraseñas y bloqueo tras N intentos fallidos.

### 2.6 Bitácora de auditoría

- Tabla `audit_log` **append-only**: sin `UPDATE` ni `DELETE` permitidos por política RLS ni por grants; revocar esos privilegios a nivel de rol de BD.
- Registrar: `actor_id`, `rol`, `accion`, `tabla`, `registro_id`, `clinic_id`, `ip`, `user_agent`, `timestamp`, y diff en JSON de los campos modificados (nunca el contenido clínico en claro).
- **Registrar también lecturas** de expedientes clínicos, no solo escrituras — es lo que exige una auditoría de privacidad real.
- Encadenamiento por hash: cada fila incluye `hash_anterior` para detectar manipulación.
- Retención mínima sugerida: 5 años. Exportable.

### 2.7 Google Calendar

- **No usar una cuenta Google personal ni compartir su contraseña.** Usar una **service account de Google Workspace con domain-wide delegation** sobre el calendario de la clínica.
- Beneficios: auditable, revocable individualmente, sin credencial compartida entre personas, sin ruptura al rotar contraseñas.
- Si se conservan refresh tokens de OAuth, cifrarlos a nivel de columna (§2.1), no solo "encriptados en BD" de forma genérica.

### 2.8 Endpoints públicos

Los endpoints sin sesión (agendar cita desde web, confirmar/cancelar por link, consulta de disponibilidad) requieren:
- **Rate limiting** por IP y por token (ej. 10 req/min), aplicado en middleware y en el edge.
- CAPTCHA o Turnstile en el formulario público de agendamiento.
- Sin enumeración: nunca revelar si un teléfono o email existe en el sistema. Respuestas genéricas.
- Validación estricta con Zod y saneamiento de toda entrada.

### 2.9 Otros controles

- HTTPS obligatorio, HSTS, cabeceras de seguridad (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- CORS restringido al dominio de la aplicación.
- Respaldos automáticos diarios cifrados **y prueba de restauración documentada al menos una vez por trimestre**. Un respaldo nunca probado no es un respaldo.
- Dependencias: `pnpm audit` en CI, Dependabot o Renovate activo.
- Secretos fuera del repositorio, con escaneo de secretos en CI.

---

## 3. Cumplimiento legal y retención de datos

> **Definir antes de escribir el esquema de base de datos.** Cambiar la política de retención después de tener datos en producción es costoso.

- Aviso de privacidad conforme a **LFPDPPP (México)** y, si aplica a pacientes de la UE, **GDPR**.
- Consentimiento informado digital, versionado: guardar `version_documento`, `fecha_aceptacion`, `ip`, y el hash del texto aceptado.
- **Conflicto a resolver explícitamente**: la normativa mexicana de expediente clínico (NOM-004-SSA3-2012 y normas asociadas) impone un periodo mínimo de conservación, mientras que la LFPDPPP otorga al titular el derecho de cancelación. Verificar con asesoría legal qué régimen aplica a fisioterapia en la jurisdicción de operación y documentar la decisión en este archivo antes de implementar.
- **Estado Fase 0**: decisión **provisional** documentada en [`docs/retencion-datos.md`](./docs/retencion-datos.md) (borrado lógico 5 años → físico/anonimización). **Pendiente confirmación legal del product owner antes de go-live.**
- Implementar en consecuencia:
  - **Borrado lógico** (`deleted_at`) para expedientes clínicos durante el periodo de conservación obligatorio.
  - **Borrado físico** al vencer el plazo, mediante job programado.
  - **Anonimización** como opción intermedia: conservar los datos clínicos con fines estadísticos, disociados de la identidad del paciente.
- Procedimiento documentado para atender solicitudes **ARCO** (acceso, rectificación, cancelación, oposición), incluyendo exportación de los datos de un paciente.
- Términos y condiciones de uso del sistema.

---

## 4. Módulo: Pacientes (Core)

- Registro: nombre, teléfono, email, fecha de nacimiento, contacto de emergencia, ocupación.
- Expediente clínico: historial médico, alergias, medicamentos, diagnósticos previos. **Campos cifrados (§2.1).**
- Historial de sesiones: fecha, terapeuta, notas de evolución, dolor (escala EVA), rango de movimiento.
- Documentos adjuntos: recetas, estudios de imagen, consentimientos informados. **Storage privado + signed URLs (§2.3).**
- Ficha de evaluación inicial: anamnesis, exploración física, diagnóstico fisioterapéutico, objetivo de tratamiento.
- Consentimiento informado y aceptación del aviso de privacidad, versionados (§3).
- Preferencias de contacto (opt-in por canal: email / SMS / WhatsApp / push), con registro de fecha y origen del consentimiento.
- **Acceso**: `recepcionista` ve datos de contacto y administrativos; **no** ve contenido clínico. Toda lectura de expediente queda en `audit_log`.

---

## 5. Módulo: Agenda y Citas

- Calendario por terapeuta (diario / semanal / mensual) con FullCalendar.io.
- Creación de citas: paciente, terapeuta, sala, duración, tipo de servicio.
- Estados: `pendiente`, `confirmada`, `en_sala_espera`, `en_consulta`, `pendiente_pago`, `completado`, `cancelado`, `no_asistio`.
- Control de disponibilidad: horario del terapeuta, bloques ocupados, días libres, capacidad de salas.
- **Sin doble reserva**: restricción a nivel de base de datos, no solo validación en UI.
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE appointments ADD CONSTRAINT no_solapamiento_terapeuta
    EXCLUDE USING gist (
      terapeuta_id WITH =,
      tstzrange(inicio, fin) WITH &&
    ) WHERE (estado NOT IN ('cancelado', 'no_asistio'));
  ```
  Aplicar una restricción equivalente para `sala_id`.
- Recordatorios automáticos según opt-in: email 24 h antes, SMS/WhatsApp 2 h antes, push 30 min antes.
- Confirmación / cancelación / reprogramación desde links de un solo uso (§2.4), con botones claros: "✅ SÍ, ASISTIRÉ" y "❌ CANCELAR".
- **Todas las marcas de tiempo en `TIMESTAMPTZ`**, calculadas en UTC. La zona horaria de la clínica se guarda en `clinic_config.timezone` (IANA, ej. `America/Managua`) y se usa solo para presentación y para programar recordatorios.

---

## 6. Módulo: Terapeutas / Staff

- Perfiles: nombre, especialidad, cédula profesional, horario laboral.
- Roles: `admin`, `terapeuta`, `recepcionista` — con permisos aplicados vía **RLS** (§2.2), no solo en la API.
- Comisiones por sesión o paquete.
- Tema preferido del usuario (claro / oscuro / sistema), persistido en BD.
- Estado de MFA visible en el perfil; el admin puede forzar reinscripción de MFA.
- Gestión de sesiones activas y cierre remoto (§2.5).

---

## 7. Módulo: Planes de Tratamiento

- Creación de plan: diagnóstico, objetivo, frecuencia (ej. 2x/semana), duración estimada.
- Ejercicios asignados: nombre, descripción, series, repeticiones, video o imagen de referencia.
- Progreso registrado por sesión, con posibilidad de modificar el plan según evolución.
- Protocolos predefinidos (plantillas: lumbalgia, hombro congelado, esguince de tobillo, etc.).
- Todo cambio al plan queda versionado y auditado.

---

## 8. Módulo: Servicios (Catálogo)

### Modelo

```sql
-- services
id UUID PK
clinic_id UUID FK NOT NULL          -- multi-tenant desde el día 1
tipo ENUM('consulta_evaluacion', 'consulta_seguimiento', 'sesion_terapia',
          'paquete_sesiones', 'producto', 'estudio_especial', 'otro')
titulo VARCHAR(255)
descripcion TEXT
costo DECIMAL(10,2)
duracion_minutos INT
requiere_autorizacion BOOLEAN DEFAULT false
activo BOOLEAN DEFAULT true
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ

-- appointment_services (lo que se aplicó en cada cita)
id UUID PK
clinic_id UUID FK NOT NULL
appointment_id UUID FK
service_id UUID FK
costo_aplicado DECIMAL(10,2)        -- precio congelado al momento de aplicar
cantidad INT DEFAULT 1
terapeuta_id UUID FK
notas TEXT
created_at TIMESTAMPTZ
```

> Mantener el precio congelado en `costo_aplicado` es correcto y debe conservarse: los reportes históricos no deben cambiar si sube el precio de lista.

### Catálogo sugerido (valores iniciales, editables desde configuración)

| Tipo | Título | Costo | Duración |
|---|---|---|---|
| `consulta_evaluacion` | Evaluación inicial | $600 | 60 min |
| `consulta_seguimiento` | Consulta de seguimiento | $400 | 30 min |
| `sesion_terapia` | Sesión de terapia manual | $500 | 45 min |
| `sesion_terapia` | Rehabilitación con equipo | $550 | 45 min |
| `sesion_terapia` | Electroestimulación | $350 | 30 min |
| `paquete_sesiones` | Paquete 5 sesiones | $2,250 | — |
| `paquete_sesiones` | Paquete 10 sesiones | $4,000 | — |
| `estudio_especial` | Análisis de movimiento | $800 | 60 min |

### Flujo en consulta

1. Terapeuta finaliza la atención.
2. Selecciona los servicios aplicados del catálogo.
3. El sistema calcula el total **en el servidor** (nunca confiar en el total enviado por el cliente).
4. La cita pasa a `pendiente_pago`.
5. Notificación a recepción: "Pago pendiente — $X".

---

## 9. Módulo: Pagos y Facturación

### Modelo

```sql
-- payments
id UUID PK
clinic_id UUID FK NOT NULL
appointment_id UUID FK
paciente_id UUID FK
idempotency_key VARCHAR(64) UNIQUE NOT NULL   -- evita cobros duplicados
metodo_pago ENUM('cash', 'transferencia')     -- futuro: 'tarjeta'
monto DECIMAL(10,2)
referencia VARCHAR(255)                        -- número de transferencia, voucher
estado ENUM('pendiente', 'pagado', 'reembolsado', 'cancelado')
pagado_en_caja BOOLEAN DEFAULT false
cajero_id UUID FK
fecha_pago TIMESTAMPTZ
comprobante_path VARCHAR(500)                  -- ruta en Storage privado, NO URL pública
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Reglas de integridad

- **Idempotencia obligatoria**: el cliente genera una `idempotency_key` al abrir el modal de cobro y la reenvía en cada intento. Doble clic o reintento de red no produce un segundo cobro. Restricción `UNIQUE` a nivel de BD.
- El monto se recalcula y valida **en el servidor** contra `appointment_services`.
- Transición de estado dentro de una transacción: `payments.estado = 'pagado'` y `daily_queue.estado = 'completado'` se confirman juntos o ninguno.
- Los pagos son **inmutables**: no se editan. Una corrección se hace con un registro de reembolso o ajuste que referencia al original, dejando el histórico intacto.
- Solo `admin` y `recepcionista` acceden a la tabla `payments` (vía RLS). El rol `terapeuta` no.
- `DECIMAL(10,2)` en BD; en TypeScript **nunca usar `number` flotante para aritmética monetaria** — trabajar en centavos con enteros o con una librería de decimales.

### Flujo de cobro (recepción)

1. Llega la notificación "💳 Pago pendiente" con detalle de servicios y total.
2. La recepcionista selecciona el método: efectivo o transferencia.
3. Efectivo: registra monto recibido; el sistema calcula el cambio.
4. Transferencia: registra referencia y banco; adjunta comprobante (Storage privado).
5. Al confirmar, en una sola transacción: pago registrado + cola completada.
6. Notificación automática: terapeuta disponible si hay siguiente paciente en cola.
7. Opcional: generar recibo PDF y enviarlo al paciente.

### Reportes de ingresos

- Por tipo de servicio (por periodo).
- Servicios más aplicados.
- Método de pago más usado.
- Corte de caja diario por recepcionista.
- Deuda pendiente por paciente.

### Extensibilidad futura (tarjeta)

```typescript
type MetodoPago = 'cash' | 'transferencia' | 'tarjeta';

interface PaymentGateway {
  procesarPago(monto: number, datos: DatosPago): Promise<PaymentResult>;
  reembolsar(transactionId: string): Promise<RefundResult>;
}
```

> Tipar `datos` explícitamente (`DatosPago`), no `any` — el proyecto usa TS strict.
> **Nunca almacenar datos de tarjeta en la base de datos.** Delegar por completo en la pasarela (tokenización) para mantenerse fuera del alcance de PCI-DSS.

---

## 10. Módulo: Cola de Atención en Tiempo Real

### Modelo

```sql
-- daily_queue (se regenera cada día vía pg_cron)
id UUID PK
clinic_id UUID FK NOT NULL
appointment_id UUID FK
patient_id UUID FK
terapeuta_id UUID FK
sala_id UUID FK NULL
fecha DATE
hora_cita TIME
hora_llegada TIMESTAMPTZ NULL
hora_inicio_atencion TIMESTAMPTZ NULL
hora_fin_atencion TIMESTAMPTZ NULL
estado ENUM('pendiente', 'en_sala_espera', 'en_consulta',
            'pendiente_pago', 'completado', 'no_asistio', 'cancelado')
prioridad INT DEFAULT 0
posicion_cola INT
notas_recepcion TEXT
version INT NOT NULL DEFAULT 0      -- optimistic locking
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Concurrencia (crítico)

Dos recepcionistas pueden operar sobre el mismo paciente casi al mismo tiempo. Sin control, se producen check-ins duplicados o consultas iniciadas dos veces.

- **Optimistic locking**: toda actualización incluye la versión leída.
  ```sql
  UPDATE daily_queue
     SET estado = $1, version = version + 1, updated_at = now()
   WHERE id = $2 AND version = $3;
  ```
  Si afecta 0 filas, la UI muestra "Otro usuario ya actualizó este registro" y recarga.
- **Máquina de estados explícita**: definir y validar en el servidor las transiciones permitidas. Rechazar cualquier salto inválido (ej. `pendiente` → `completado`).
- El reordenamiento de la cola por drag & drop se resuelve en una sola transacción del lado del servidor, no con múltiples updates desde el cliente.

### Vista tipo kanban (recepción)

```
🟢 EN CONSULTA
  • María García — Dr. López — Consultorio 3
    [Finalizar]

🟡 EN SALA DE ESPERA
  1. Juan Pérez     ⏱ 08:00 ✓
  2. Pedro López    ⏱ 09:00 ✓  ← acaba de llegar

⚪ PENDIENTES
  3. Carlos Ruiz    ⏱ 10:00
  4. Ana Silva      ⏱ 10:30

💳 PENDIENTE PAGO
  • Rosa Torres     $1,100    [Cobrar]

✅ COMPLETADOS
  • Laura Méndez    ⏱ 08:00 ✔️
```

### Eventos en tiempo real

Suscripción de Supabase Realtime a `postgres_changes` sobre `daily_queue`, filtrada por `clinic_id`. El cliente deriva los siguientes eventos lógicos a partir de los cambios de estado:

| Evento lógico | Origen |
|---|---|
| `queue:new` | INSERT en `daily_queue` |
| `queue:checkin` | estado → `en_sala_espera` |
| `queue:start` | estado → `en_consulta` |
| `queue:complete` | estado → `completado` |
| `queue:pending_payment` | estado → `pendiente_pago` |
| `queue:paid` | INSERT en `payments` con estado `pagado` |
| `queue:reschedule` | UPDATE de `hora_cita` |
| `queue:cancel` | estado → `cancelado` |
| `queue:priority` | UPDATE de `prioridad` / `posicion_cola` |

> **Importante**: la suscripción de Realtime respeta las políticas RLS. Verificar que un terapeuta no reciba eventos de pacientes que no le corresponden.

---

## 11. Módulo: Sistema de Notificaciones

### Arquitectura

```
Acción → NotificationService → INSERT en notifications → Supabase Realtime (staff en línea)
                             → Edge Function + pg_cron → Email (Resend) / SMS (Twilio)
```

### Notificaciones para recepción

| Evento | Sonido | Contenido |
|---|---|---|
| Cita agendada | ✅ | 📅 Nuevo paciente — nombre, hora, teléfono |
| Cita cancelada por paciente | ✅ (distinto) | ❌ Paciente canceló — nombre, hora, motivo |
| Consulta finalizada / terapeuta disponible | ✅ | 🟢 Dr. X disponible — Siguiente: nombre del paciente |
| Check-in del paciente | ✅ | 🟡 Paciente en sala — nombre |
| Pago pendiente | ✅ | 💳 Cobrar $X — nombre del paciente |
| Pago registrado | ✅ | ✅ $X cobrado — nombre |
| Confirmación de cita desde link | ✅ | ✅ Paciente confirmó asistencia |

> **Privacidad**: el contenido de las notificaciones **nunca incluye información clínica** (diagnóstico, motivo médico). Solo datos administrativos. Las notificaciones push del navegador y los SMS son especialmente sensibles: aparecen en pantallas bloqueadas.

### Sonido

- Archivos `.mp3` ligeros precargados, diferenciados por tipo de evento.
- Reproducción envuelta en `try/catch` — si el navegador la bloquea, falla en silencio.
- Botón "🔊 Activar/Desactivar" persistido en `localStorage`.

### Destino

- Las notificaciones de recepción se difunden a todo el rol dentro del mismo `clinic_id`: todas las recepcionistas las reciben simultáneamente.
- Canal por tenant: `clinic:{clinicId}:role:recepcion`.

### Recordatorios al paciente (opt-in desde su perfil)

- **24 h antes**: email HTML con links de confirmar / cancelar (tokens de un solo uso, §2.4).
- **2 h antes**: SMS o WhatsApp vía Twilio, si el paciente lo configuró.
- **30 min antes**: push del navegador si está en el sitio.
- Programación con `pg_cron`, calculada en UTC a partir de `clinic_config.timezone`.
- **Reintentos con backoff exponencial** ante fallo del proveedor, con máximo de intentos y registro del resultado (`notification_deliveries`).
- Página de destino: confirmación visual + opción de reagendar si canceló.

### Centro de notificaciones (UI)

```
🔔 NOTIFICACIONES                      🔊 Sonido: ACTIVO

┌──────────────────────────────────────────────┐
│ 🟢 Dr. López disponible           hace 30s   │
│    Siguiente: Pedro López                    │
├──────────────────────────────────────────────┤
│ 📅 Juan Pérez agendó cita         hace 2min  │
│    Hoy 10:00 AM - Evaluación                 │
├──────────────────────────────────────────────┤
│ ❌ Ana Silva canceló              hace 5min  │
│    Motivo: No especificado                   │
└──────────────────────────────────────────────┘

[🗑️ Limpiar todas]
```

- Badge con contador de no leídas en la barra de navegación.
- Toasts emergentes de 5 s.
- Persistencia en tabla `notifications` con `leida BOOLEAN` y `leida_en TIMESTAMPTZ`.
- Purga automática de notificaciones con más de 90 días.

---

## 12. Módulo: Inventario

- Productos: órtesis, vendajes, cremas, equipos de rehabilitación.
- Control de stock: entradas, salidas, mínimo requerido, alertas de reorden.
- Venta de productos como servicio de tipo `producto`, vinculado a paciente y pago.
- Consumibles por sesión (registro de material usado).
- Los movimientos de stock son **append-only** (tabla `inventory_movements`); la existencia actual es un cálculo derivado, nunca un contador editable a mano.

---

## 13. Módulo: Reportes y Estadísticas

- Pacientes nuevos por periodo.
- Sesiones realizadas por terapeuta.
- Ingresos diarios / semanales / mensuales por servicio y método de pago.
- Tasa de retención y de ausentismo.
- Tratamientos más comunes.
- Productos más vendidos.
- Corte de caja por recepcionista.
- Exportación a PDF / Excel / CSV.
- **Exportaciones auditadas**: toda exportación que contenga datos de pacientes se registra en `audit_log` (quién, qué, cuándo). Restringida al rol `admin`.
- Los reportes agregados se generan sobre datos **disociados** siempre que sea posible.

---

## 14. Módulo: Integración Google Calendar

### Para staff — calendario de la clínica

- **Service account de Google Workspace con domain-wide delegation** sobre el calendario de la clínica (§2.7). No usar una cuenta personal compartida.
- Configuración una sola vez por el administrador.
- Detalle del evento — **sin información clínica**:
  - Título: `[Terapeuta] Paciente — Tipo de servicio`
  - Descripción: referencia interna `#CitaID` y notas administrativas. **No incluir diagnóstico, motivo médico ni datos del expediente**, ya que el calendario puede compartirse ampliamente.
  - Ubicación: sala o consultorio.
  - Color por tipo de consulta.
- Los terapeutas ven el calendario compartido desde su Google Calendar personal (se comparte desde Google, no desde el sistema).
- Límites de tasa manejados con cola de Edge Functions y reintentos con backoff exponencial.
- Credenciales de la service account en Supabase Vault; si se usan refresh tokens OAuth, cifrados a nivel de columna.
- La sincronización es **best-effort**: un fallo de Google nunca debe bloquear la creación de la cita en el sistema. Encolar y reintentar.

### Para el paciente — link "Añadir a Google Calendar"

- Botón en la pantalla de confirmación y en el email.
- URL con parámetros estándar:
  ```
  https://www.google.com/calendar/render?action=TEMPLATE
    &text=Fisioterapia+-+Nombre+Clínica
    &dates=20260730T150000Z/20260730T160000Z
    &details=Confirmación+de+cita
    &location=Dirección+de+la+clínica
  ```
- No requiere OAuth del paciente.
- El texto del evento no revela el motivo de la consulta.

---

## 15. Módulo: Configuración del Sistema

- Datos de la clínica: nombre, dirección, logo, teléfono, RFC.
- **`timezone`** (IANA) — obligatorio, base de todo cálculo de recordatorios.
- Sucursales (dirección, teléfono, horario).
- Salas de consulta: nombre, equipamiento.
- Métodos de pago habilitados.
- Tipos de consulta y duraciones por defecto.
- Preferencias de recordatorios (24 h / 2 h / 30 min; canales habilitados).
- Conexión con Google Calendar.
- Tema por defecto de la clínica (claro / oscuro / sistema).
- **Políticas de seguridad configurables**: minutos de inactividad para auto-logout, exigencia de MFA por rol, periodo de retención de expedientes.
- Respaldo y restauración de BD, con registro de la última prueba de restauración exitosa.

---

## 16. Módulo: UX / UI — Temas (modo oscuro / claro)

### Modelo

```sql
ALTER TABLE staff ADD COLUMN tema_preferido TEXT
  CHECK (tema_preferido IN ('claro','oscuro','sistema')) DEFAULT 'sistema';
ALTER TABLE clinic_config ADD COLUMN tema_defecto TEXT
  CHECK (tema_defecto IN ('claro','oscuro','sistema')) DEFAULT 'sistema';
```

> Usar `TEXT` con `CHECK` en lugar de `ENUM` nativo: agregar valores a un `ENUM` de PostgreSQL requiere migración y no puede hacerse dentro de una transacción con otras operaciones.

### Lógica de carga

1. Detectar `prefers-color-scheme` del sistema operativo.
2. Si el usuario tiene preferencia guardada (BD para staff, `localStorage` para paciente o visitante), usar esa.
3. Si no hay preferencia, usar `clinic_config.tema_defecto`.
4. Si la clínica no tiene configuración, usar `'sistema'`.

### Guardado

- Staff autenticado: se guarda en `staff.tema_preferido` (BD), se aplica al instante mediante clase CSS en `<html>` y se refleja en una cookie para SSR.
- Paciente o visitante: `localStorage`.
- Sin recarga de página.

### Implementación

- Tailwind CSS con `darkMode: 'class'`.
- Estado global en React Context + hook `useTheme()`: `{ theme, setTheme, isDark, isSystem }`.
- `<html class="dark">` renderizado desde el servidor (Next.js) leyendo la cookie, para evitar el parpadeo inicial.

### Selector

```
🌙 Tema: [Oscuro ●  Claro ○  Sistema ○]
```

### Diseño general

- Responsive: escritorio, tablet y móvil.
- Dashboard con resumen: citas de hoy, pacientes en espera, ingresos del día.
- Cola de atención tipo kanban con arrastrar y soltar.
- Centro de notificaciones con badge de no leídas.
- Toasts emergentes.
- Accesibilidad: contraste AA, navegación por teclado, `aria-live` en el centro de notificaciones.
- Interfaz en español.

---

## 17. Plan de implementación por fases

> **No construir los 17 módulos de una sola vez.** Cada fase debe quedar funcional, probada y desplegable antes de pasar a la siguiente.

### Fase 0 — Cimientos (antes de cualquier funcionalidad)
- Repositorio, TypeScript strict, ESLint, Prettier, CI.
- Proyecto Supabase, esquema base con `clinic_id` en todas las tablas.
- **RLS activado en todas las tablas desde el inicio**, con pruebas por rol.
- Auth + roles + MFA + auto-logout.
- `audit_log` append-only funcionando.
- Utilidades de cifrado a nivel de columna.
- Gestión de secretos y respaldos configurados.
- Decisión legal de retención documentada (§3).

### Fase 1 — Núcleo operativo
- Módulo Pacientes (4).
- Módulo Agenda y Citas (5), incluyendo la restricción de no solapamiento.
- Módulo Terapeutas / Staff (6).
- Configuración mínima del sistema (15): datos de clínica, `timezone`, salas.
- **Entregable**: la clínica ya puede registrar pacientes y agendar citas.
- **Estado**: implementado en código (UI `/app/pacientes`, `/app/agenda`, `/app/staff`, `/app/configuracion` + migración `20260730150000_fase1_nucleo.sql`). Pendiente: aplicar migración en Supabase real y pruebas RLS contra BD local.

### Fase 2 — Flujo de atención y dinero
- Módulo Servicios (8).
- Módulo Cola de Atención en tiempo real (10), con optimistic locking.
- Módulo Pagos (9), con idempotencia y transacciones.
- **Entregable**: el día completo de la clínica funciona en el sistema, del check-in al cobro.
- **Estado**: implementado (`/app/servicios`, `/app/cola`, `/app/caja` + migración `20260730180000_fase2_flujo_dinero.sql` con RPCs `sync_daily_queue`, `update_queue_estado`, `finalize_consultation`, `register_payment`). Notificaciones in-app mínimas incluidas; canales email/SMS quedan en Fase 3.

### Fase 3 — Comunicación
- Módulo Notificaciones (11): tiempo real + recordatorios + tokens de un solo uso.
- Integración con Google Calendar (14).
- Módulo Planes de Tratamiento (7).
- **Entregable**: reducción de ausentismo por recordatorios automáticos.
- **Estado**: implementado — migración `20260730200000_fase3_comunicacion.sql`; UI `/app/planes`, centro de notificaciones, páginas `/cita/[accion]/[token]` (POST); cron `/api/cron/reminders`; Calendar best-effort + link paciente. Configurar Resend/Twilio/Google/CRON_SECRET en entorno.

### Fase 4 — Gestión y análisis
- Módulo Inventario (12).
- Módulo Reportes y Estadísticas (13).
- Temas y refinamiento de UX (16).
- **Entregable**: visibilidad de negocio y control de existencias.
- **Estado**: implementado — migración `20260730220000_fase4_gestion.sql` (`products`, `inventory_movements` append-only, vista `product_stock`, RPCs `record_inventory_movement` / `sell_product`); UI `/app/inventario`, `/app/reportes`; temas con cookie SSR anti-FOUC + selector; dashboard con citas/espera/ingresos/stock. Pendiente: aplicar migración en Supabase y pruebas RLS contra BD local.

---

## 18. Estrategia de pruebas

> Priorizar pruebas donde un error cuesta dinero, datos o cumplimiento legal.

**Obligatorias (no negociables):**
- **Políticas RLS**: un caso por rol, verificando acceso permitido y acceso denegado. Se ejecutan en CI.
- **Cálculo de pagos**: totales, redondeo, cambio en efectivo, aritmética en centavos.
- **Idempotencia de cobros**: dos solicitudes con la misma clave producen un solo pago.
- **Concurrencia en la cola**: dos actualizaciones simultáneas, una debe fallar limpiamente.
- **Tokens de cita**: expiración, un solo uso, token inválido, token de otra cita.
- **Fechas y zonas horarias**: recordatorios de 24 h / 2 h / 30 min calculados correctamente, incluyendo cambios de horario si aplican a la zona.
- **No solapamiento de citas**: la restricción de BD rechaza el traslape.

**Recomendadas:**
- E2E del flujo completo: agendar → check-in → consulta → cobro → completado.
- Pruebas de cifrado y descifrado de campos clínicos.
- Prueba de restauración de respaldo (manual, trimestral, documentada).

---

## 19. Instrucciones de trabajo para Claude Code

1. Lee este documento completo antes de escribir código.
2. Trabaja **una fase a la vez** (§17). Al terminar una fase, resume qué se implementó y qué falta antes de continuar.
3. **Nunca implementes una tabla sin su política RLS en la misma migración.**
4. TypeScript strict. Sin `any`. Sin `@ts-ignore`.
5. Valida toda entrada con Zod, con el mismo esquema compartido entre cliente y servidor.
6. Los cálculos de dinero y las decisiones de autorización se hacen **siempre en el servidor**.
7. Ante ambigüedad en un requisito legal, de retención o de privacidad: **detente y pregunta**, no asumas.
8. Escribe las pruebas de §18 junto con el código, no al final.
9. Mantén este archivo actualizado: si una decisión de arquitectura cambia, refléjala aquí antes de implementarla.
