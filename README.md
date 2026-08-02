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

### Cron de recordatorios

**Obligatorio en producción.** Vercel Cron está configurado en [`vercel.json`](./vercel.json)
para invocar `/api/cron/reminders` cada 15 minutos vía GET. Vercel añade
automáticamente el header `Authorization: Bearer $CRON_SECRET` si la variable
de entorno `CRON_SECRET` está definida en el proyecto — solo hay que
configurarla en Vercel (Project Settings → Environment Variables).

Para probar manualmente (local o prod):

```bash
curl "$NEXT_PUBLIC_APP_URL/api/cron/reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

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
