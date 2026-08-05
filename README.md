# Terafis

Sistema de gestión para clínica de fisioterapia.

Fuente de verdad del producto: [`plan-clinica-fisioterapia.md`](./plan-clinica-fisioterapia.md).

## Stack

- Next.js (App Router) + TypeScript strict + Tailwind CSS
- Supabase (PostgreSQL + RLS + Auth + Storage + Realtime)
- Prisma (tipado / migraciones de apoyo)
- Zod, Vitest, Prettier, ESLint, GitHub Actions CI

## Fase actual

**Fase 3 — Comunicación**:

- Tokens de cita un solo uso (confirmar/cancelar/reagendar) vía POST
- Recordatorios opt-in (email 24h / SMS 2h / push 30m) + `notification_deliveries` con backoff
- Centro de notificaciones en vivo (badge + sonido opcional)
- Google Calendar: cola best-effort + link “Añadir a Calendar” para paciente
- Planes de tratamiento versionados (cifrados) + protocolos
- Migración: `supabase/migrations/20260730200000_fase3_comunicacion.sql`

**Fases 0–2**: cimientos, núcleo operativo, flujo de atención y dinero

### Recordatorios / jobs en segundo plano

El plan **Hobby de Vercel no incluye Cron** (o se agota el cupo). Por eso
**no** hay `vercel.json` con crons: el deploy no depende de Vercel Cron.

El endpoint `/api/cron/reminders` sigue disponible (GET/POST) y requiere
`Authorization: Bearer $CRON_SECRET`. Alternativas:

1. **Manual / bajo demanda** (probar o disparar a mano):

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/cron/reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

2. **Scheduler externo gratis** (cron-job.org, EasyCron, GitHub Actions
   `schedule`, etc.) apuntando a esa URL cada 15–60 min con el header.

3. **Supabase `pg_cron` + Edge Function / `net.http_post`** hacia la misma URL.

Sin scheduler, la app despliega y opera con normalidad; solo dejan de
procesarse automáticamente recordatorios y la cola de Google Calendar.

## Arranque local

```bash
pnpm install
cp .env.example .env.local
# Completar SUPABASE_* , DATABASE_URL , FIELD_ENCRYPTION_KEY , SEARCH_HMAC_KEY

pnpm db:generate
pnpm dev
```

Generar llaves de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Aplicar migración SQL (Supabase CLI o SQL Editor del proyecto):

```bash
pnpm supabase:start
# o: supabase db push
```

## Scripts

| Script                      | Uso               |
| --------------------------- | ----------------- |
| `pnpm dev`                  | Desarrollo        |
| `pnpm test`                 | Pruebas unitarias |
| `pnpm typecheck`            | TypeScript strict |
| `pnpm lint` / `pnpm format` | Calidad de código |
| `pnpm db:generate`          | Cliente Prisma    |

## Seguridad

No commitear `.env*`. Los secretos viven en Vercel / Supabase Vault.
Toda tabla de negocio nace con RLS; ver `supabase/migrations/`.
