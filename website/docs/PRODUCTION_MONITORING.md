# Production monitoring

This runbook defines the minimum production coverage for the Omnix website. It uses signals already emitted by the application and leaves alert delivery provider-neutral. It does not claim traffic, conversion, latency, or error-rate baselines that have not been observed.

## Principles

- Keep customer PII, demo references, payment references, licence keys, raw provider errors, and environment values out of logs and alerts.
- Treat the database as the source of truth for durable demo requests, payments, entitlements, publication state, and audit events. Consent-gated analytics is directional measurement, not the durable business record.
- Public media and customer proof fail closed. An absent item is not automatically an incident; alert only when an approved, expected publication fails its gate or disappears.
- Start with deterministic failure alerts. Establish rate and conversion thresholds only after collecting representative production data and recording the chosen baseline window.

## Coverage matrix

| Area | Primary signal | Initial alert condition | First response |
| --- | --- | --- | --- |
| Public availability | Synthetic `GET /ke`, `/ke/pharmacy`, `/robots.txt`, `/sitemap.xml` | Two consecutive non-2xx responses from the same check, then confirm from a second network | Check Vercel deployment/functions, DNS, middleware redirects, and database reachability |
| Application errors | Vercel function status grouped by route; `[global error boundary]`; scoped error-boundary markers | Any sustained 5xx sequence; page immediately for protected mutation/payment failures | Identify deployment and route, reproduce without copying request bodies, roll back only if current release caused it |
| Demo persistence | `POST /api/demo-requests` status and `[demo-requests] persistence failed:` | Any 503 or persistence marker | Verify database and migration state; do not ask the prospect to resubmit until persistence is healthy |
| Demo notification | `[demo-requests] notification failed:` and `[email] demo-request delivery skipped:` | Any durable request whose notification failed | Contact from the persisted admin record, then verify Resend configuration; never copy PII into the incident channel |
| Conversion funnel | Consent-gated GA4 `page_view`, `video_start`, `whatsapp_click`, `generate_lead`, `begin_checkout`; database demo-request count | Event schema disappears or `generate_lead` no longer follows a successful persisted demo in a controlled test | Verify consent, GA ID validation, and event enum wiring. Do not infer lost leads from GA alone |
| Paystack initialization | `POST /api/paystack/init` status | Any repeatable 5xx in a controlled test or production failure cluster | Verify Paystack settings and provider status; do not log request body or customer email |
| Paystack webhook | HTTP status; `[webhook] settlement transaction failed`; `[webhook] purchase email send failed — requesting retry`; audit actions `payment.amount_mismatch` and `payment.license_missing` | Any amount mismatch, missing licence, settlement failure, or webhook retry exhaustion | Preserve webhook retries, inspect payment and entitlement records in admin, reconcile before manual mutation |
| Payment backlog | Pending payment rows compared with provider state | Alert threshold must be set only after normal settlement delay is measured; until then review aged pending rows daily | Verify webhook delivery and exact-once settlement before manual action |
| Cron jobs | Vercel cron invocation status and JSON result | Any 401, `503 cron_not_configured`, or missed daily invocation | Verify `CRON_SECRET`, schedule, database, and Resend; re-run only with the authenticated endpoint |
| Public media | Admin media state, `media.approve` audit event, expected slot resolution, five-minute cache ceiling | Approved/published expected slot remains absent after cache ceiling, or public object returns non-2xx | Verify provenance, platform-admin approval audit, MIME/slot match, object publication, and cache invalidation; never bypass the gate |
| Module demo video | Published row completeness and public product page | A product marked published has invalid ID/title/summary or remains absent | Correct the admin record; do not introduce arbitrary embed HTML or a non-privacy YouTube origin |
| Customer proof | Evidence, permission, approval audit, publication digest, optional approved logo | Approved expected proof fails any evidence/permission/digest gate | Re-verify the exact publication envelope and permission; absence is safer than bypassing validation |
| Search/indexing | Search Console coverage, sitemap fetch, sampled canonical/hreflang checks | Sitemap cannot be fetched, canonical changes unexpectedly, invalid hreflang appears, or protected/draft paths become indexable | Compare the deployed sitemap and metadata with route policy; request reindexing only after correction |
| Local SEO | Kenya guide/location index coverage and sampled rendered metadata | Non-Kenya locale location/guide pages become indexable or required Kenya pages disappear | Verify locale policy, `dynamicParams`, sitemap inclusion, canonical, and no invented local-business claims |
| Release feeds | `/api/releases/latest`, `/api/releases-latest`, release ingest status | Feed 5xx, invalid signature state, or CI ingest rejection | Verify database, ingest token, release metadata, and signing artifacts without exposing download secrets |

## Funnel dashboard

Build a consent-aware funnel using only the closed event dimensions already emitted by the site:

1. Public `page_view`, grouped by normalized route and locale.
2. `video_start`, grouped by product and `module_demo`.
3. `whatsapp_click`, grouped by approved surface/product/locale dimensions.
4. `generate_lead`, emitted only after the demo request API returns a persisted success.
5. `begin_checkout`, retained for existing customer payment flows, not promoted as the primary public acquisition path.

Report the database count of new demo requests beside GA4 leads. Differences can be caused by denied analytics consent and must not be labelled as lost or failed requests. Do not set conversion targets until a documented production baseline exists.

## Search and canonical dashboard

Track:

- Successful fetch and parse of `/robots.txt` and `/sitemap.xml`.
- Presence of the five public product URLs.
- Presence of only explicitly published blog URLs.
- A rotating sample of canonical and `en-KE`/other valid BCP-47 alternates.
- Exclusion of legacy AI documentation and non-Kenya local guide/location variants.
- Search Console indexing and crawl errors once the production property is verified.

A page-count change alone is not an incident because reviewed content may be added or removed. Alert on policy violations and unexpected route loss instead.

## Error and log queries

Create saved log queries for these stable, PII-safe markers:

- `[demo-requests] persistence failed:`
- `[demo-requests] notification failed:`
- `[email] magic-link send skipped:`
- `[email] demo-request delivery skipped:`
- `[webhook] settlement transaction failed`
- `[webhook] purchase email send failed — requesting retry`
- `[cron]` reminder failures
- `[releases-latest]` database/signature failures
- `[global error boundary]`

Some older log sites can include raw provider error objects. Do not forward raw log payloads into third-party alerts; use a redacted excerpt and route/status metadata only.

## Severity and response

- **Critical:** payment settled without entitlement evidence, amount mismatch, missing licence during settlement, destructive/bootstrap route authorization regression, broad outage, or public exposure of unapproved media/customer proof. Stop the affected operation and escalate immediately.
- **High:** demo persistence unavailable, authentication unavailable, repeated webhook failures, cron authentication/configuration failure, or release feed failure affecting active clients.
- **Medium:** notification delivery failure after durable persistence, approved media/video unexpectedly absent, search canonical/indexing regression, or repeated non-transactional 5xx.
- **Low/advisory:** performance drift, isolated third-party beacon/CSP noise, or consent-denied analytics gaps.

Record impact using verified counts only. Never estimate customers affected from unverified analytics.

## Deployment annotations and review cadence

Annotate dashboards with the Git commit and Vercel deployment identifier. After each production deployment, run the smoke checks in `DEPLOYMENT_READINESS.md` and inspect new errors. Review deterministic failures daily during initial operation. Choose rate, latency, pending-payment-age, and funnel thresholds only after a representative observation window has been documented; this runbook intentionally supplies no fabricated baseline.
