# Prompts por fase — Terafis

> Copiar **un prompt a la vez** en Claude Code / Cursor.
> Fuente de verdad: [`plan-clinica-fisioterapia.md`](./plan-clinica-fisioterapia.md) (§17 fases, §18 pruebas).
> No implementar módulos de fases posteriores. TypeScript strict. UI en español. Comentarios en español.
> Toda tabla nueva nace con RLS + políticas en la misma migración. Dinero y autorización siempre en servidor.

---

## Prefacio común (pegar al inicio de cualquier fase)

```
Eres un ingeniero senior implementando Terafis (clínica de fisioterapia).

Antes de escribir código:
1. Lee plan-clinica-fisioterapia.md completo (especialmente §0–§2, §17, §18 y la sección de la fase).
2. Revisa el estado actual del repo: README.md, supabase/migrations/, src/, tests/.
3. Trabaja SOLO esta fase. No adelantes módulos de fases siguientes.
4. Al terminar: resume qué se implementó, qué tests pasan, y qué queda pendiente.

Reglas innegociables:
- TypeScript strict: sin any, sin @ts-ignore.
- Validación Zod compartida cliente/servidor.
- Multi-tenant: clinic_id en tablas de negocio.
- RLS ENABLE + FORCE en toda tabla nueva; políticas por rol (admin / terapeuta / recepcionista).
- Campos clínicos cifrados (AES-256-GCM); audit_log append-only; lecturas clínicas auditadas.
- Dinero en centavos enteros (src/lib/money/cents.ts); nunca number flotante para aritmética monetaria.
- UI en español. Comentarios de código en español.
- Escribe las pruebas de aceptación de esta fase JUNTO con el código (Vitest en tests/).
- Criterio de cierre: pnpm typecheck && pnpm lint && pnpm test en verde; checklist de tests de la fase marcado.

Stack: Next.js App Router, Supabase (Postgres+RLS+Auth+Realtime+Storage), Prisma tipado, Zod, Vitest, FullCalendar, Tailwind.
```

---

## Fase 0 — Cimientos

### Prompt

```
[Incluir prefacio común]

## Tarea: completar / verificar Fase 0 — Cimientos

Objetivo: base segura multi-tenant antes de cualquier funcionalidad de negocio.

Alcance (§17 Fase 0):
- Repositorio, TS strict, ESLint, Prettier, CI.
- Esquema base con clinic_id; RLS en todas las tablas desde el inicio.
- Auth + roles (admin, terapeuta, recepcionista) + MFA (admin/terapeuta) + auto-logout.
- audit_log append-only con encadenamiento por hash.
- Utilidades de cifrado de columna (AES-GCM) y HMAC de búsqueda.
- Secretos fuera del repo (.env.example sin secretos reales).
- Decisión de retención documentada en docs/retencion-datos.md.

Estado esperado del repo: gran parte ya existe (migración 20260730120000_fase0_cimientos.sql).
NO implementes pacientes/agenda/cola/pagos. Solo cierra huecos de Fase 0.

Entregable: cimientos listos para Fase 1; tests de abajo en verde o documentados con it.todo solo si falta BD local, indicando cómo activarlos.
```

### Tests de aceptación (Fase 0)

| #    | Tipo           | Caso                                   | Resultado esperado                                                                                                                           |
| ---- | -------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | Unit           | `tests/crypto/aes-gcm.test.ts`         | Cifrar/descifrar round-trip; ciphertext distinto en cada llamada (IV aleatorio); falla con clave incorrecta                                  |
| 0.2  | Unit           | `tests/crypto/clinical-fields.test.ts` | Serializa campos clínicos → blob cifrado → recupera plaintext                                                                                |
| 0.3  | Unit           | `tests/audit/hash-chain.test.ts`       | Cadena de hashes válida; detectar manipulación si se altera un eslabón                                                                       |
| 0.4  | Unit           | `tests/roles/roles.test.ts`            | Matriz de capacidades: recepción sin clínico; terapeuta sin pagos/audit; admin con audit                                                     |
| 0.5  | Unit           | Headers / env                          | Variables requeridas fallan en build si faltan; no hay secretos hardcodeados                                                                 |
| 0.6  | RLS (BD local) | admin                                  | Ve `staff`, `clinic_config`, `audit_log` de su `clinic_id`; no ve otra clínica                                                               |
| 0.7  | RLS (BD local) | terapeuta                              | Ve staff de su clínica; **no** puede `SELECT audit_log`                                                                                      |
| 0.8  | RLS (BD local) | recepcionista                          | Ve staff; **no** puede `SELECT audit_log`                                                                                                    |
| 0.9  | RLS (BD local) | FORCE RLS                              | Table owner / service role en tests de política no bypasea RLS de usuario                                                                    |
| 0.10 | Integridad     | `audit_log`                            | Política/grants impiden `UPDATE` y `DELETE`                                                                                                  |
| 0.11 | Manual         | Auth                                   | Login funciona; auto-logout por inactividad configurado; MFA exigido a admin/terapeuta (o flag documentado pendiente de activar en Supabase) |
| 0.12 | Docs           | Retención                              | `docs/retencion-datos.md` existe y marca decisión provisional + pendiente legal                                                              |

**Comando de cierre:** `pnpm typecheck && pnpm lint && pnpm test`

---

## Fase 1 — Núcleo operativo

### Prompt

```
[Incluir prefacio común]

## Tarea: completar / verificar Fase 1 — Núcleo operativo

Objetivo: la clínica puede registrar pacientes y agendar citas.

Alcance (§17 Fase 1 + módulos §4, §5, §6, config mínima §15):
- Pacientes: contacto + patient_clinical cifrado; recepción sin contenido clínico; lecturas clínicas en audit_log.
- Agenda: FullCalendar; estados de cita; EXCLUDE btree_gist sin doble reserva (terapeuta y sala).
- Staff: perfiles, horarios, roles vía RLS, MFA force-reenroll.
- Config: datos de clínica, timezone IANA, salas.
- Migración: supabase/migrations/20260730150000_fase1_nucleo.sql

Estado del repo: UI en /app/pacientes, /app/agenda, /app/staff, /app/configuracion parcialmente hecha.
Prioridad: aplicar migración, cerrar huecos, y convertir it.todo de RLS/solapamiento en tests reales contra Supabase local.

NO implementes servicios, cola, pagos, notificaciones email, inventario ni reportes.

Entregable: flujo “alta paciente → agendar cita” usable; tests de la checklist en verde.
```

### Tests de aceptación (Fase 1)

| #    | Tipo        | Caso                      | Resultado esperado                                                                                        |
| ---- | ----------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1.1  | Unit        | Schemas pacientes         | Payload válido pasa; email/teléfono inválidos fallan (`tests/patients/schemas.test.ts`)                   |
| 1.2  | Unit        | Transiciones cita         | Flujo `pendiente→confirmada→…`; rechaza `pendiente→completado` (`tests/appointments/transitions.test.ts`) |
| 1.3  | Unit        | Timezone clínica          | Conversión UTC ↔ zona IANA correcta (`tests/datetime/clinic-tz.test.ts`)                                  |
| 1.4  | Unit        | Cifrado clínico           | Al guardar, BD no contiene plaintext de historial/alergias                                                |
| 1.5  | RLS         | recepcionista             | Puede leer datos de contacto del paciente; **no** `SELECT patient_clinical`                               |
| 1.6  | RLS         | terapeuta                 | Solo ve `patient_clinical` de pacientes con cita asignada a él; no ve otras clínicas                      |
| 1.7  | RLS         | admin                     | CRUD pacientes/citas/staff/config dentro de su `clinic_id`                                                |
| 1.8  | BD          | No solapamiento terapeuta | Segundo INSERT que solapa horario del mismo terapeuta (estado activo) falla por `EXCLUDE`                 |
| 1.9  | BD          | No solapamiento sala      | Equivalente para `sala_id`                                                                                |
| 1.10 | BD          | Cancelados                | Citas `cancelado` / `no_asistio` **sí** permiten reutilizar el slot                                       |
| 1.11 | Audit       | Lectura clínica           | Leer expediente inserta fila en `audit_log` (acción de lectura)                                           |
| 1.12 | Integración | Alta + cita               | Crear paciente + cita con terapeuta/sala/timezone; aparece en agenda                                      |
| 1.13 | Manual UI   | Roles                     | Recepcionista no ve panel clínico; terapeuta/admin sí (según política)                                    |

**Comando de cierre:** `pnpm supabase:start` → aplicar migraciones → `pnpm test` (incl. RLS) + smoke manual del flujo.

---

## Fase 2 — Flujo de atención y dinero

### Prompt

```
[Incluir prefacio común]

## Tarea: implementar Fase 2 — Flujo de atención y dinero

Objetivo: el día completo funciona — del check-in al cobro.

Alcance (§17 Fase 2 + §8 Servicios, §10 Cola, §9 Pagos):
1. Catálogo `services` + `appointment_services` con `costo_aplicado` congelado.
2. Cola `daily_queue`: kanban recepción, Realtime, optimistic locking (`version`), máquina de estados, reorder en una transacción servidor.
3. Pagos: `idempotency_key` UNIQUE, monto recalculado en servidor, efectivo (cambio) / transferencia (comprobante Storage privado), pagos inmutables (reembolso = nueva fila).
4. Transacción atómica: `payments.estado=pagado` + `daily_queue.estado=completado`.
5. RLS: terapeuta NO accede a `payments`; recepción/admin sí. Notificaciones in-app mínimas (sin email/SMS aún).
6. Migración base: supabase/migrations/20260730180000_fase2_flujo_dinero.sql — completar UI, server actions, RPCs y tests.

Rutas sugeridas: /app/cola, /app/servicios (o config), cobro desde cola/notificación.
Schemas existentes: src/lib/queue/schemas.ts, src/lib/services/schemas.ts, src/lib/money/cents.ts.

NO implementes recordatorios Resend/Twilio, tokens de cita, Google Calendar, inventario ni reportes (Fase 3/4).

Entregable: check-in → consulta → servicios → pendiente_pago → cobro → completado, con tests críticos de dinero/concurrencia en verde.
```

### Tests de aceptación (Fase 2)

| #    | Tipo          | Caso              | Resultado esperado                                                                                                 |
| ---- | ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2.1  | Unit          | Centavos          | Totales, redondeo a 2 decimales, cambio efectivo (`tests/money/cents.test.ts` + totales de `appointment_services`) |
| 2.2  | Unit          | Total servidor    | Cliente envía total manipulado → servidor recalcula desde `appointment_services` y rechaza/ignora el del cliente   |
| 2.3  | Unit          | Transiciones cola | `canQueueTransition`: permite check-in/consulta/pago; rechaza `pendiente→completado`                               |
| 2.4  | Unit          | Schemas cobro     | Zod: método cash requiere `monto_recibido`; transferencia requiere `referencia`                                    |
| 2.5  | Concurrencia  | Optimistic lock   | Dos `UPDATE` con misma `version`: uno OK, otro 0 filas → error limpio “Otro usuario ya actualizó…”                 |
| 2.6  | Idempotencia  | Doble cobro       | Dos POST con misma `idempotency_key` → un solo `payments` pagado; segunda respuesta idempotente (mismo id)         |
| 2.7  | Transacción   | Cobro             | Si falla actualizar cola, no queda pago `pagado` huérfano (rollback)                                               |
| 2.8  | Inmutabilidad | Pagos             | No hay UPDATE de monto/estado a `pagado` editado; corrección vía reembolso con `payment_ref_id`                    |
| 2.9  | RLS           | terapeuta         | `SELECT/INSERT payments` denegado                                                                                  |
| 2.10 | RLS           | recepcionista     | Puede cobrar; no lee campos clínicos                                                                               |
| 2.11 | RLS           | Realtime cola     | Terapeuta solo recibe cambios de filas de sus pacientes (política Realtime/RLS)                                    |
| 2.12 | Storage       | Comprobante       | Path privado; signed URL corta; MIME inválido rechazado                                                            |
| 2.13 | E2E (recom.)  | Día completo      | agendar → check-in → consulta → servicios → cobro cash → `completado`                                              |
| 2.14 | Precio        | Congelado         | Subir precio de catálogo no cambia `costo_aplicado` histórico                                                      |

**Archivos de test sugeridos:**

- `tests/queue/transitions.test.ts`
- `tests/queue/optimistic-lock.test.ts`
- `tests/payments/totals.test.ts`
- `tests/payments/idempotency.test.ts`
- `tests/rls/fase2-payments-queue.test.ts`

---

## Fase 3 — Comunicación

### Prompt

```
[Incluir prefacio común]

## Tarea: implementar Fase 3 — Comunicación

Objetivo: reducir ausentismo con recordatorios y cerrar el circuito de confirmación; planes de tratamiento versionados.

Alcance (§17 Fase 3 + §11 Notificaciones, §14 Google Calendar, §7 Planes):
1. NotificationService: INSERT notifications + Realtime al staff; sin datos clínicos en el payload.
2. Recordatorios opt-in: email 24h (Resend), SMS/WhatsApp 2h (Twilio), push 30min; pg_cron + Edge Functions; reintentos con backoff (`notification_deliveries`).
3. Tokens de cita (§2.4): opacos, hasheados SHA-256, un solo uso, POST (no GET), expiración ≤48h / hasta la cita; acciones confirmar/cancelar/reagendar.
4. Endpoints públicos: rate limit, Turnstile/CAPTCHA, sin enumeración de email/teléfono.
5. Google Calendar: service account + domain-wide delegation; sync best-effort; evento sin info clínica; link “Añadir a Calendar” para paciente.
6. Planes de tratamiento: diagnóstico, objetivo, ejercicios, plantillas, versionado + audit.

Prerrequisito: Fase 2 cerrada (cola y pagos estables).
NO implementes inventario ni reportes/exportaciones (Fase 4).

Entregable: paciente recibe recordatorio y puede confirmar/cancelar con token de un solo uso; staff ve notificaciones en tiempo real.
```

### Tests de aceptación (Fase 3)

| #    | Tipo       | Caso          | Resultado esperado                                                                                                  |
| ---- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| 3.1  | Unit       | Token hash    | Se almacena SHA-256 del token; plaintext no persiste en BD                                                          |
| 3.2  | Tokens     | Un solo uso   | Segundo uso del mismo token → rechazado; `usado_en` marcado en la misma transacción que la acción                   |
| 3.3  | Tokens     | Expirado      | Token vencido → 4xx genérico                                                                                        |
| 3.4  | Tokens     | Otra cita     | Token de cita A no actúa sobre cita B                                                                               |
| 3.5  | Tokens     | Método        | `GET` no ejecuta cancelación; solo `POST` tras página de confirmación                                               |
| 3.6  | TZ         | Recordatorios | Con `America/Managua` (u otra IANA), ventanas 24h / 2h / 30min calculadas en UTC correctamente (incl. borde de día) |
| 3.7  | Opt-in     | Canales       | Sin opt-in SMS → no se encola SMS; email sí si está permitido                                                       |
| 3.8  | Privacidad | Payload       | Notificaciones/SMS/Calendar **sin** diagnóstico ni notas clínicas                                                   |
| 3.9  | Públicoos  | Rate limit    | >N req/min desde IP → 429                                                                                           |
| 3.10 | Públicos   | Enumeración   | Respuesta idéntica si email existe o no                                                                             |
| 3.11 | Calendar   | Best-effort   | Fallo de Google no bloquea creación de cita; queda en cola de reintento                                             |
| 3.12 | Planes     | Versionado    | Editar plan crea versión nueva; audit_log registra cambio                                                           |
| 3.13 | RLS        | Planes        | Terapeuta solo planes de sus pacientes; recepción sin contenido clínico del plan                                    |
| 3.14 | Entregas   | Backoff       | Fallo proveedor → reintento con backoff; tope de intentos registrado en `notification_deliveries`                   |

**Archivos de test sugeridos:**

- `tests/appointments/action-tokens.test.ts`
- `tests/notifications/schedule-windows.test.ts`
- `tests/notifications/privacy-payload.test.ts`
- `tests/calendar/event-shape.test.ts`
- `tests/treatment-plans/versioning.test.ts`

---

## Fase 4 — Gestión y análisis

### Prompt

```
[Incluir prefacio común]

## Tarea: implementar Fase 4 — Gestión y análisis

Objetivo: visibilidad de negocio, control de existencias y refinamiento UX (temas).

Alcance (§17 Fase 4 + §12 Inventario, §13 Reportes, §16 Temas):
1. Inventario: productos, movimientos append-only (`inventory_movements`); stock = derivado; alertas de mínimo; venta como servicio tipo `producto` ligada a pago.
2. Reportes: pacientes nuevos, sesiones/terapeuta, ingresos por periodo/método, ausentismo, corte de caja; export PDF/Excel/CSV.
3. Exportaciones auditadas: solo admin; toda export con datos de paciente → `audit_log`.
4. Agregados preferentemente disociados (sin PII cuando baste).
5. Temas: `staff.tema_preferido` + `clinic_config.tema_defecto`; Tailwind `darkMode: 'class'`; cookie SSR anti-FOUC; selector claro/oscuro/sistema.
6. UX: dashboard resumen, a11y AA, `aria-live` en notificaciones.

Prerrequisito: Fases 0–3 cerradas.
No reabrir decisiones de retención legal sin preguntar.

Entregable: admin ve reportes y corte de caja; stock coherente; tema sin parpadeo.
```

### Tests de aceptación (Fase 4)

| #    | Tipo       | Caso           | Resultado esperado                                                                                 |
| ---- | ---------- | -------------- | -------------------------------------------------------------------------------------------------- |
| 4.1  | Unit       | Stock derivado | Entrada + salida → existencia correcta; no existe UPDATE directo de “existencia”                   |
| 4.2  | Integridad | Append-only    | `inventory_movements` no permite UPDATE/DELETE (RLS/grants)                                        |
| 4.3  | Negocio    | Reorden        | Stock ≤ mínimo → alerta generada                                                                   |
| 4.4  | Negocio    | Venta producto | Venta decrementa stock y genera `appointment_services`/`payment` coherente                         |
| 4.5  | Reportes   | Ingresos       | Suma del periodo = suma de pagos `pagado` (centavos); coincide con corte de caja                   |
| 4.6  | Reportes   | Ausentismo     | Tasa = no_asistio / citas del periodo (definición documentada en test)                             |
| 4.7  | RLS        | Export         | Recepcionista/terapeuta no pueden exportar listados con PII; admin sí                              |
| 4.8  | Audit      | Export         | Export CSV de pacientes escribe `audit_log` (quién, qué, cuándo)                                   |
| 4.9  | Privacidad | Agregados      | Endpoint de estadísticas no filtra nombres/diagnósticos en claro                                   |
| 4.10 | Theme      | Precedencia    | preferencia staff > tema clínica > sistema                                                         |
| 4.11 | Theme      | SSR            | Primera pintura respeta cookie (sin flash claro→oscuro)                                            |
| 4.12 | Manual     | a11y           | Contraste AA en temas; teclado en kanban/notificaciones; `aria-live` anuncia nuevas notificaciones |

**Archivos de test sugeridos:**

- `tests/inventory/stock.test.ts`
- `tests/reports/revenue.test.ts`
- `tests/reports/export-audit.test.ts`
- `tests/theme/resolution.test.ts`
- `tests/rls/fase4-inventory-reports.test.ts`

---

## Matriz rápida §18 (obligatorias → fase)

| Prueba obligatoria del plan             | Fase                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| Políticas RLS por rol                   | 0 (base), 1 (clínico), 2 (pagos/cola), 3–4 (ampliar) |
| Cálculo de pagos / centavos             | 2                                                    |
| Idempotencia de cobros                  | 2                                                    |
| Concurrencia en la cola                 | 2                                                    |
| Tokens de cita                          | 3                                                    |
| Fechas y zonas horarias (recordatorios) | 1 (base TZ), 3 (ventanas)                            |
| No solapamiento de citas                | 1                                                    |
| E2E día completo                        | 2 (recomendada)                                      |
| Cifrado clínico                         | 0–1                                                  |
| Restauración de respaldo                | Manual trimestral (ops, no bloquea fase)             |

---

## Cómo usar en la práctica

1. Abrir chat nuevo → pegar **Prefacio común** + **Prompt de la fase**.
2. Pedir al agente que marque cada fila de la tabla de tests como `PASS` / `FAIL` / `SKIP(motivo)`.
3. No pasar de fase hasta: código + migración RLS + tests obligatorios de esa fase en verde.
4. Actualizar `plan-clinica-fisioterapia.md` §17 si cambia el estado de la fase.
