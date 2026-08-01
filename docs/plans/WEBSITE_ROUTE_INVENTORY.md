# Omnix Website Route & UI Inventory

**Status:** Phase 0 baseline  
**Scope:** `website/` only  
**Machine contract:** `website/src/config/route-inventory.ts`  
**Regression test:** `website/tests/int/route-inventory.int.spec.ts`

## 1. Inventory summary

The Next.js App Router currently exposes **84 page routes**, **52 route handlers**, **7 layouts**, **2 loading boundaries**, **2 error boundaries**, and **1 root not-found boundary**.

| Route group | Pages | Primary shell | Redesign owner |
| --- | ---: | --- | --- |
| Public marketing/content | 34 | Localized frontend layout | Phases 1, 3, 4, 6 |
| Authentication | 4 | Auth layout | Phase 5 — Account |
| Onboarding | 1 | Root + pass-through layout | Phase 5 — Account |
| Checkout | 4 | Pass-through checkout layout | Phase 5 — Commerce |
| Region restriction | 1 | Root layout | Phase 5 — Account |
| Customer dashboard | 18 | Dashboard layout + `DashboardShell` | Phase 5 — Customer Dashboard |
| Platform admin | 22 | Admin layout + `AdminShell` | Phase 5 — Admin |
| **Total** | **84** |  |  |

The machine contract groups every exact route and fails tests when a page or route handler is added, removed, or moved without being classified.

## 2. Page routes

### 2.1 Public marketing and content — 34

```text
/[locale]
/[locale]/about
/[locale]/ai
/[locale]/blog
/[locale]/blog/[slug]
/[locale]/changelog
/[locale]/contact
/[locale]/dawa
/[locale]/developers
/[locale]/docs
/[locale]/docs/[slug]
/[locale]/downloads
/[locale]/etims
/[locale]/hardware
/[locale]/hospitality
/[locale]/migration
/[locale]/modules
/[locale]/modules/[slug]
/[locale]/mpesa
/[locale]/partners
/[locale]/payroll-pack
/[locale]/pharmacy
/[locale]/pricing
/[locale]/privacy
/[locale]/pro
/[locale]/refund-policy
/[locale]/retail
/[locale]/roadmap
/[locale]/salon
/[locale]/security
/[locale]/sha
/[locale]/support
/[locale]/team
/[locale]/terms
```

**Current ownership**

- `app/[locale]/(frontend)/layout.tsx`: localized provider, session probe, marketing header/footer, WhatsApp, analytics, organization JSON-LD.
- `components/layout/site-header.tsx`: desktop dropdown navigation, mobile sheet, language and theme controls, account/trial CTA.
- `components/layout/site-footer.tsx`: product/resource/company/legal navigation and settings-backed contacts.
- `components/marketing/variant-landing.tsx`: shared Pro, Pharmacy, Retail, Hospitality, Hardware, and Salon body template.
- `components/landing/*`: homepage sections.
- `components/marketing/legal-layout.tsx`: legal routes.
- Seed files own blog, docs, and module content.

**Immediate findings**

1. Child pages generally inherit the locale homepage canonical, hreflang, OpenGraph, and Twitter metadata.
2. Header/footer links are mostly bare non-localized paths, causing redirects and broken active states under `/{locale}`.
3. `/blog` links to slugs that do not match `POSTS_SEED`; current cards lead to 404s.
4. `/docs` publicly exposes generated TODO/scaffold articles.
5. `/pharmacy` and `/dawa` duplicate the same page intent.
6. `/pro` uses a temporary redirect although its comment describes a permanent redirect.
7. Navigation, pricing, downloads, and modules disagree on whether Omnix sells four, five, or Pro-inclusive products.
8. `/developers` links to nonexistent `/dashboard/api-keys`.
9. Several live routes are absent from the sitemap.
10. Kenya-specific eTIMS/M-Pesa/SHA pages are emitted across all locales while canonicalizing to `/ke`.

### 2.2 Authentication — 4

```text
/login
/signup
/forgot-password
/verify-email/[token]
```

**Current ownership**

- `(auth)/layout.tsx`: wordmark, help link, legal footer.
- `SignInForm`: active passwordless Google/magic-link login.
- `LoginForm`, `SignupForm`, and `ForgotPasswordForm`: unreferenced legacy components using obsolete flows.

**State coverage**

- Sign-in has pending, inline error, and email-sent success states.
- Signup, forgot-password, and verify-email are redirect-only.
- No auth-specific loading, error, or not-found boundary exists.

### 2.3 Onboarding and region — 2

```text
/onboarding
/region-unavailable
```

- `OnboardingWizard` owns seven-step profile setup and client validation.
- Only the dashboard overview enforces profile completion; deep dashboard links bypass onboarding.
- Region restriction currently rewrites restricted API requests to an HTML page as well as UI requests.
- Neither route has a shaped loading or error boundary.

### 2.4 Checkout — 4

```text
/buy
/buy/[licenseId]
/buy/cancelled
/buy/success
```

**Current ownership**

- Checkout layout is pass-through; each route creates its own shell.
- `CheckoutForm` owns Paystack script and popup state.

**Critical findings**

1. `/buy/success` trusts an arbitrary query reference and presents “licence active” without verifying session or payment.
2. `/buy` mutates state during GET by creating a trial.
3. Trial policy is split between 14 and 30 days.
4. Billing uses purpose values the checkout resolver does not consistently recognize.
5. Pro is offered in some onboarding/checkout paths while disabled in others.
6. Paystack script failure has no `onError` recovery and can leave checkout disabled forever.
7. Authenticated login forwarding accepts an unvalidated `next` target.

### 2.5 Customer dashboard — 18

```text
/dashboard
/dashboard/affiliate
/dashboard/billing
/dashboard/downloads
/dashboard/downloads/[variant]
/dashboard/licenses
/dashboard/licenses/[id]
/dashboard/machines
/dashboard/machines/[id]
/dashboard/payments
/dashboard/payments/[id]
/dashboard/profile
/dashboard/reseller
/dashboard/reseller/new
/dashboard/support
/dashboard/support/[id]
/dashboard/support/new
/dashboard/team
```

**Current shell and components**

- `(dashboard)/layout.tsx`: shared session gate and settings load.
- `DashboardShell`: desktop/mobile navigation, top bar, account menu, support card.
- `PageHeading`, status helpers, `EntityHero`, `LazyTabs`, forms and action buttons provide partial shared vocabulary.
- Affiliate and reseller routes largely bypass the shared vocabulary.

**Navigation gaps**

- Team and Reseller are omitted from the main shell navigation.
- A notification control displays a permanent unread state but performs no action.
- Mobile/account menus lack complete Escape, outside-click, focus, and ARIA behavior.

**Data-state gaps**

- Licences, machines, and payments are searched and paginated.
- Support tickets, team records, affiliate credits, reseller tables, and detail-tab lists are not consistently searched or paginated.
- Support detail has no reply composer despite `TicketReplyForm` already existing.
- Team’s no-organization state has no action to resolve the condition.
- `/dashboard/downloads/[variant]` duplicates and contradicts the main downloads experience.
- One generic loading skeleton represents every dashboard route.

### 2.6 Platform admin — 22

```text
/admin
/admin/audit
/admin/audit/[id]
/admin/customers/new
/admin/licenses
/admin/licenses/[id]
/admin/machines
/admin/machines/[id]
/admin/media
/admin/orgs
/admin/orgs/[id]
/admin/payments
/admin/payments/[id]
/admin/releases
/admin/settings
/admin/team
/admin/team/[id]
/admin/team-members
/admin/tickets
/admin/tickets/[id]
/admin/users
/admin/users/[id]
```

**Current shell and permission model**

- `admin/layout.tsx` admits `platform_admin`, `support_agent`, and `sales_rep`.
- `AdminShell` owns the sidebar, mobile drawer, account footer, and complete admin navigation.
- Navigation is not capability-filtered; all staff roles see all destinations.
- Media, team-members, and settings add page-level platform-admin gates.
- Multiple mutation controls remain visible to support/sales even when their APIs require platform-admin.

**Current data patterns**

- Users, organizations, machines, licences, payments, and tickets use server-side search and URL pagination at 50 rows/page.
- Audit is capped at 300, releases at 50, media at 500; staff and public team members are unbounded.
- Detail tabs often use fixed result caps without search or pagination.
- Several card components are legacy/unreferenced; current indexes use tables.

**State coverage**

- `admin/loading.tsx` is the only admin loading boundary.
- There is no admin-local error boundary.
- Indexes usually have good empty states; detail tabs mostly use terse “No …” rows.
- Client mutations mix toasts, inline errors, and imperative alerts.

## 3. Route handlers — 52

| API domain | Count | Examples | Redesign safety rule |
| --- | ---: | --- | --- |
| Platform admin | 17 | customers, licences, media, releases, settings, team, reseller controls | Preserve API gates and audit writes; capability-hide UI only |
| Signed-in account | 11 | trial, machines, licences, team invitations, support, affiliate, Paystack init | Preserve ownership and organization-role checks |
| Payment callback | 1 | Paystack webhook | Preserve signature verification and idempotency |
| Desktop/licensing | 10 | activation, validation, sync, rebind, telemetry, updater, backups | Website redesign must not alter desktop contracts |
| Release feeds | 3 | latest/update manifests and ingest | Preserve version, signature, channel, and 204 behavior |
| Public API v1 | 3 | health, licences, machines | Preserve API-key scopes and rate limits |
| Bootstrap/cron | 5 | migration, bootstrap, daily jobs, retention | Preserve token gates; separately address fail-open risks |
| Public site | 2 | OG image, partnerships | Reuse for marketing and partner flows |
| **Total** | **52** |  |  |

Exact routes and groups are defined in `website/src/config/route-inventory.ts` and verified directly against `src/app`.

## 4. Layout and boundary inventory

### Layouts — 7

1. `app/layout.tsx` — fonts, global CSS, theme provider, dialog host.
2. `app/[locale]/(frontend)/layout.tsx` — public marketing shell.
3. `app/(auth)/layout.tsx` — authentication shell.
4. `app/onboarding/layout.tsx` — pass-through.
5. `app/(checkout)/layout.tsx` — pass-through.
6. `app/(dashboard)/layout.tsx` — authenticated customer shell.
7. `app/admin/layout.tsx` — staff role gate and admin shell.

### Loading boundaries — 2

- `app/(dashboard)/dashboard/loading.tsx`
- `app/admin/loading.tsx`

### Error boundaries — 2

- `app/(dashboard)/error.tsx`
- `app/global-error.tsx`

### Not-found boundaries — 1

- `app/not-found.tsx`

Auth, onboarding, checkout, marketing, and admin currently lack route-group-specific error coverage. Detail routes fall back to the generic root 404.

## 5. Shared UI ownership

| Surface | Existing owner | Required direction |
| --- | --- | --- |
| Theme | `ThemeProvider`, `ThemeToggle`, `globals.css` | Real light default, dark parity, no hydration flash |
| Marketing navigation | `SiteHeader`, `SiteFooter` | Four products, locale-aware links, Demo primary |
| Marketing pages | `PageHero`, `VariantLanding`, landing sections | Product-specific structures, real product evidence |
| Forms | UI primitives + route-specific forms | Unified labels, errors, focus, success, rate-limit recovery |
| Customer portal | `DashboardShell` + mixed helpers | One coherent shell and page vocabulary |
| Admin | `AdminShell`, `DataControls`, shared detail helpers | Capability-aware navigation and dense operational design |
| Tables | Shared `Table`, admin URL controls, ad hoc raw tables | Search and pagination everywhere data can grow |
| Empty/loading/error | Multiple local patterns | Procedural shared states with route-shaped skeletons |
| Destructive actions | Route-specific buttons/clients | Consistent consequence copy, confirmation, audit preservation |

## 6. Security and behavioral boundaries

The redesign must not weaken or silently change:

- Server-side session, ownership, staff-role, API-key, machine-token, webhook-signature, bootstrap-token, or system-token checks.
- Licensing activation/validation/rebind/updater response contracts used by the desktop app.
- Payment idempotency and server-side price calculation.
- Audit records for users, roles, resellers, customers, licences, payments, settings, releases, and update policy.
- Secret masking/encryption and the rule that decrypted values never enter browser state or logs.
- Soft-delete, seat-release, invitation-cancel, and irreversible-delete semantics.
- Search/filter query parameter names until explicit migration tests exist.

Security issues discovered during inventory—such as checkout-success trust, open redirect risk, licensing-sync exposure, tokenless validation, rebind limits, cron fail-open behavior, and paid-licence deletion inconsistency—must be addressed as explicit security work rather than hidden inside cosmetic changes.

## 7. Regression contract

`tests/int/route-inventory.int.spec.ts` recursively scans `src/app` and verifies:

1. Every `page.tsx` is present in `PAGE_ROUTE_GROUPS`.
2. Every `route.ts` and `route.tsx` is present in `API_ROUTE_GROUPS`.
3. The expected totals remain 84 pages and 52 handlers.
4. No route is classified twice.

Any future route change now fails the targeted test until its redesign and ownership are explicitly accounted for.
