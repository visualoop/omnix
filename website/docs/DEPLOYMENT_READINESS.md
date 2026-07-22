# Vercel deployment readiness

This checklist is for the Omnix website only. It does not modify the Tauri/Rust desktop application or its licensing, database, updater, permissions, and release contracts.

## Project configuration

- Set the Vercel project root directory to `website`.
- Use pnpm with the checked-in lockfile and Node 20 or newer.
- Build command: `pnpm run build`.
- Framework preset: Next.js.
- Keep the two schedules in `vercel.json`: `/api/cron/daily` at 02:00 UTC and `/api/cron/telemetry-retention` at 03:00 UTC.
- Do not weaken the application CSP to allow analytics injected by a forwarding or hosting layer. Application analytics remain consent-gated.
- Preview and production must not share destructive bootstrap credentials unless that is a deliberate operational decision.

## Required environment names

No values belong in this document.

### Core runtime

Configure one database connection name, plus all other entries:

- `DATABASE_URL` or `POSTGRES_URL`
- `NEXT_PUBLIC_SITE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `PLATFORM_SETTINGS_MASTER`

`NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` must identify the target environment. Do not point a preview at the production callback origin.

### Protected operations

- `BOOTSTRAP_TOKEN`
- `CRON_SECRET`
- `RELEASE_INGEST_TOKEN`
- `TELEMETRY_RETENTION_DAYS` (optional; defaults to the source-defined retention period)

Bootstrap and cron handlers fail closed when their server secret is absent. Keep `BOOTSTRAP_TOKEN` available only while its one-shot routes are operationally required, then remove those routes in a separate verified release.

### Demo, authentication, and email

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `DEMO_REQUESTS_EMAIL` (optional routing override)
- `PARTNERSHIPS_EMAIL` (optional routing override)
- `SALES_EMAIL` (optional routing fallback)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (optional Google sign-in pair)

Magic-link authentication and email notifications require a working Resend configuration. Google credentials are optional if Google sign-in is intentionally unavailable.

### Existing payment flows

- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`

The Paystack secret key verifies webhooks as well as server-side API requests. There is no separate Paystack webhook secret in the active platform-settings model.

### Optional storage and cloud backup

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_MEDIA_BUCKET`
- `S3_MEDIA_QUARANTINE_BUCKET`
- `S3_PUBLIC_URL`
- `R2_BACKUP_BUCKET`
- `CLOUD_BACKUP_ENABLED`
- `CLOUD_BACKUP_PRICE_MONTHLY`
- `CLOUD_BACKUP_RETENTION_DAYS`

The media quarantine bucket must be private and different from the public media bucket. Missing storage settings must leave public media fail closed.

### Optional public and operational configuration

- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- `GH_TOKEN`

Support email and WhatsApp can also be configured by a platform administrator at `/admin/settings`. WhatsApp surfaces stay hidden while unset. Analytics stays absent until a valid GA identifier is configured and the visitor explicitly consents.

## Database and admin readiness

Before production traffic:

1. Confirm the target database exists and all checked-in Drizzle migrations have been applied.
2. Confirm a platform administrator can sign in and access `/admin/settings`.
3. Configure `site.support_email` and `site.whatsapp`; verify only the configured WhatsApp destination is rendered.
4. Verify Resend, Paystack, Google, and storage from the admin settings test actions only when each integration is intended to be live.
5. Confirm the two Vercel cron invocations authenticate and return success. A `503 cron_not_configured` response is a configuration failure.
6. Confirm release ingest uses `RELEASE_INGEST_TOKEN`; the legacy `PAYLOAD_SYSTEM_TOKEN` fallback should not be used for new configuration.

## Release gates

Run after the final source change:

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run test:int
pnpm run build
pnpm run test:e2e
```

The browser suite must use an isolated server. For the Blyss environment, application port 3100 maps to `https://3100.blyss.co.ke`; the unrelated port-3000 process must remain untouched.

## Post-deployment smoke checks

- Canonical redirect and localized home: `/` and `/ke`.
- Exact public catalogue: `/ke/pharmacy`, `/ke/retail`, `/ke/hospitality`, `/ke/hardware`, `/ke/salon`.
- Pricing and acquisition: KES 30,000 one-time licence, optional KES 12,000 annual compliance updates, primary Book a demo CTA, and no public Pro/AI/trial acquisition.
- Demo request: submit a controlled internal test and verify durable persistence plus expected notification behavior.
- Authentication: request a magic link without exposing the link or recipient in logs.
- Search: `/robots.txt`, `/sitemap.xml`, canonical URLs, and valid BCP-47 hreflang metadata.
- Trust gates: unpublished media, incomplete demo videos, draft blog articles, and unevidenced customer proof remain absent.
- Scheduled jobs: verify authenticated execution in Vercel logs without printing the bearer value.

Do not place customer data, licence keys, payment references, email addresses, phone numbers, or environment values in deployment notes or alert payloads.
