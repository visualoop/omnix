# Omnix website

The public marketing, authentication, customer dashboard, administration, licensing, payment, release, and support service for Omnix. It is a Next.js App Router application backed by Neon/PostgreSQL with Better Auth, Drizzle, Paystack, Resend, and optional S3-compatible storage.

The public catalogue is Pharmacy, Retail, Hospitality, Hardware & Equipment, and Salon & Spa. Public acquisition is demo-led. The commercial model is a KES 30,000 one-time perpetual Windows licence with optional KES 12,000 annual compliance updates; updates are not required to keep a perpetual licence working.

## Local development

Requirements: Node 20+, pnpm 9+, and a PostgreSQL connection for database-backed routes.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Do not commit local environment files. Environment names and deployment requirements are documented in [`docs/DEPLOYMENT_READINESS.md`](docs/DEPLOYMENT_READINESS.md); values belong in local secret storage, Vercel, or platform-admin settings.

## Validation

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run test:int
pnpm run build
pnpm run test:e2e
```

Run browser tests against an isolated server and do not reuse an unrelated process. In the Blyss development environment, port 3100 is forwarded as `https://3100.blyss.co.ke`.

## Database

Schema changes are managed in `drizzle/migrations`. Production database migrations are an explicit release operation; a successful Next.js build does not prove that the target database is configured or migrated.

## Administration

Platform administrators manage public support email, WhatsApp, approved media, module demo videos, email/payment/storage integrations, and other site settings at `/admin/settings`. Sensitive database-backed settings are encrypted with `PLATFORM_SETTINGS_MASTER`.

## Deployment

The Vercel project root must be `website`. `vercel.json` configures security/cache headers and the daily application and telemetry-retention cron jobs. Both jobs fail closed unless `CRON_SECRET` is configured.

Use the release checklist in [`docs/DEPLOYMENT_READINESS.md`](docs/DEPLOYMENT_READINESS.md), then apply the monitoring runbook in [`docs/PRODUCTION_MONITORING.md`](docs/PRODUCTION_MONITORING.md).
