# OMNIX WEBSITE - Rewrite and Launch Plan

**Goal:** Replace the stale Duka website plan with an Omnix platform website plan that sells complete vertical packages, supports licensing/support/updates, and becomes the operating system for sales, customer self-service, releases, telemetry, and owner administration.

This plan must be completed before implementation starts. The existing website docs are visually and technically useful, but their brand, pricing, module, and funnel assumptions are now wrong. Preserve the design system; rewrite the business and content structure.

## 0. Non-negotiable decisions

- Platform name: **Omnix**.
- Modules/packages keep their own names under Omnix.
- Customer-facing pricing is by complete vertical package, not Starter/Business/Enterprise tiers.
- Internally, Core exists as shared architecture. Externally, normal customers buy a package.
- No Standard/Pro/Enterprise pricing language.
- No feature-denial tiers.
- Maintenance is annual and tied to updates, compliance, support, and new minor versions.
- The app keeps working when maintenance lapses, but updates/support/compliance changes stop.
- Website must be built from Payload CMS + Next.js 15 as previously planned, with the same approved visual direction, but with corrected data model and pages.


## 0.1 Design preservation rule

The website rewrite must **not** change the approved design direction from the existing website plans. The rewrite changes the business architecture, naming, pricing, routes, Payload data model, checkout flow, and content. It does not replace the visual language.

Keep from the current website plan:
- Dark-default premium SaaS direction.
- Linear/Vercel/Stripe/Resend/Cal.com/Supabase reference quality.
- Warm amber accent system unless a later brand pass explicitly changes it.
- Inter for UI and Space Grotesk for display.
- Border-led surfaces, restrained cards, no heavy shadows.
- Real product screenshots, not 3D laptop mockups.
- No purple/cyan gradients.
- No emoji-led marketing.
- No stock-photo businessperson aesthetic.
- Same performance budgets, visual bible discipline, and acceptance standards.

Rewrite means:
- Duka -> Omnix.
- Tier pricing -> complete package pricing.
- Core as customer-facing product -> Core as internal platform layer.
- Existing module list -> Omnix package/module architecture.
- Existing checkout -> package checkout and renewal/add-on flows.
- Existing dashboard -> package/license/device/branch/maintenance dashboard.

Rewrite does **not** mean:
- Change the dark premium design.
- Invent a new palette.
- Change typography.
- Change the overall layout quality bar.
- Make the site look more local by making it visually busy or decorative.

## 1. Brand architecture

### Public architecture

- **Omnix** - parent platform.
- **Omnix Dawa** - pharmacy management.
- **Omnix Retail** - retail, duka, cosmetics, minimart.
- **Omnix Hospitality** - restaurant, cafe, bar, lodge, hotel.
- **Omnix Salon** - salon, barber, spa.
- **Omnix Hardware** - hardware and building materials.
- **Omnix Workshop** - repair, job cards, service businesses.
- Future: **Omnix Wholesale** - distribution and route sales.

### Rule

The website should say:

> Omnix is the platform. Pick the module built for your business.

Avoid saying customers buy "Core". Core is internal product architecture.

## 2. Existing website docs to rewrite

### Rewrite, do not patch lightly

The current website suite is in `docs/website/01-06`. It should be preserved as historical planning, then superseded by Omnix-specific replacements or addenda.

Required rewrite targets:

1. `01-mission-stack.md`
   - Replace Duka with Omnix.
   - Replace `BRAND_NAME = "Duka"` with `BRAND_NAME = "Omnix"`.
   - Keep stack decisions unless changed later.
   - Update visual direction to Omnix: serious Kenyan operational platform, not generic SaaS.

2. `02-collections-data-model.md`
   - Replace license `tier` with package/module fields.
   - Add package pricing model.
   - Add lead/demo pipeline.
   - Add package interest tracking.
   - Add competitor/source tracking.
   - Add module-specific license entitlements.

3. `03-pages-and-dashboards.md`
   - Replace tier pricing page with package pricing.
   - Add package checkout routes.
   - Add compare pages.
   - Add module pages for Hospitality, Salon, Hardware, Workshop.
   - Add help center structure.
   - Update customer dashboard around package/license/device/branch/maintenance.

4. `04-cicd-release-pipeline.md`
   - Rename Duka release artifacts to Omnix.
   - Ensure updater endpoint is package/license aware.
   - Add channel support by customer entitlement if needed.

5. `05-telemetry-sdk.md`
   - Rename Duka to Omnix.
   - Add active package/module telemetry.
   - Keep strict privacy/no business data rules.

6. `06-acceptance-visual-bible.md`
   - Replace Duka copy and tier pricing references.
   - Add package page visual bible.
   - Add competitor comparison page acceptance.
   - Add help center acceptance.

## 3. Corrected website information architecture

### Public marketing

```text
/
/pricing
/modules
/modules/dawa
/modules/retail
/modules/hospitality
/modules/salon
/modules/hardware
/modules/workshop
/compare
/compare/pharmasync
/compare/cloud-pos
/compare/restaurant-pos
/compare/excel
/compare/odoo
/downloads
/changelog
/help
/help/install
/help/license-activation
/help/add-device
/help/add-branch
/help/backup-restore
/help/etims-setup
/help/mpesa-paystack-setup
/help/user-roles
/help/offline-lan-mode
/help/printer-troubleshooting
/blog
/about
/contact
/book-demo
/support
/privacy
/terms
/refund-policy
```

### Auth and checkout

```text
/signup
/login
/forgot-password
/verify-email/[token]
/buy/dawa
/buy/retail
/buy/hospitality
/buy/salon
/buy/hardware
/buy/workshop
/buy/renew/[licenseId]
/buy/add-device/[licenseId]
/buy/add-branch/[licenseId]
/buy/success
/buy/cancelled
```

### Customer dashboard

```text
/dashboard
/dashboard/licenses
/dashboard/licenses/[id]
/dashboard/devices
/dashboard/branches
/dashboard/downloads
/dashboard/payments
/dashboard/support
/dashboard/support/new
/dashboard/support/[id]
/dashboard/maintenance
/dashboard/profile
```

### Owner admin

Payload native admin plus custom owner views:

```text
/admin
/admin/views/sales-pipeline
/admin/views/trials
/admin/views/revenue
/admin/views/installs-map
/admin/views/telemetry-overview
/admin/views/support-load
/admin/views/maintenance-renewals
/admin/views/module-demand
```

## 4. Homepage plan

Homepage job: route the visitor into the right package quickly.

### Section order

1. Header
   - Omnix wordmark.
   - Product, Modules, Pricing, Downloads, Help.
   - Sign in, Book demo, Start trial.

2. Hero
   - H1: `Run your business on Omnix.`
   - Sub: `Offline-first ERP for Kenyan pharmacies, shops, restaurants, salons, hardware stores, and service businesses.`
   - CTAs: `Find your package`, `Book a demo`.
   - Visual: real Omnix desktop screenshots, not laptop mockups.

3. Business type selector
   - Pharmacy -> Omnix Dawa.
   - Retail/duka -> Omnix Retail.
   - Restaurant/hotel -> Omnix Hospitality.
   - Salon/barber -> Omnix Salon.
   - Hardware -> Omnix Hardware.
   - Repair/service -> Omnix Workshop.

4. Why Omnix
   - Works offline.
   - Kenyan payments and compliance.
   - Staff controls and audit trail.
   - Branch/device licensing.
   - Own your data.

5. Product proof
   - POS screenshot.
   - Inventory screenshot.
   - Reports screenshot.
   - Settings/RBAC screenshot after built.

6. Module highlights
   - Cards for each package with one sentence and key workflow.

7. Pricing teaser
   - Package price examples, no tiers.

8. Owner trust section
   - Local support.
   - Data ownership.
   - Maintenance promise.
   - No forced cloud subscription.

9. CTA
   - `Choose your Omnix package`.
   - `Talk on WhatsApp`.

## 5. Pricing model for website

### Public pricing page structure

The pricing page should not ask customers to choose a tier. It should ask what business they run.

Cards:

| Package | Audience | First-year license | Annual maintenance |
|---|---|---:|---:|
| Omnix Retail | duka, minimart, cosmetics, boutique | KES 45k-60k | KES 18k-24k |
| Omnix Dawa | pharmacy | KES 70k-90k | KES 30k-36k |
| Omnix Hospitality | restaurant, cafe, bar, hotel | KES 80k-120k | KES 36k-48k |
| Omnix Salon | salon, barber, spa | KES 35k-50k | KES 15k-20k |
| Omnix Hardware | hardware/building materials | KES 65k-90k | KES 24k-36k |
| Omnix Workshop | repair/service | KES 50k-75k | KES 20k-30k |

Numbers can remain ranges until final price decision. Payload should support exact prices, ranges, and "talk to us" pricing.

### Add-ons, kept simple

- Extra device: KES 10k-15k one-time.
- Extra branch: KES 20k-40k depending on setup complexity.
- Heavy data migration: quoted.
- On-site training: quoted.
- Priority support retainer: optional monthly support contract.

### Copy rule

Do not say: `Starter`, `Business`, `Enterprise`.

Say:

> One complete system for your business type. First device and first year maintenance included.

## 6. Payload data model changes

### Replace license tier

Old concept:

```ts
license.tier = 'starter' | 'business' | 'enterprise'
```

New concept:

```ts
license.package = 'dawa' | 'retail' | 'hospitality' | 'salon' | 'hardware' | 'workshop' | 'custom'
license.modules = ['core', 'dawa']
license.maxDevices = 1
license.maxBranches = 1
license.maintenanceUntil = date
license.majorVersionCap = 1
```

### Collections to add or adjust

#### Packages

Marketable purchasable products.

Fields:
- `packageId`
- `name`
- `slug`
- `moduleIds`
- `businessTypes`
- `shortDescription`
- `longDescription`
- `startingPriceKes`
- `priceMode`: exact/range/custom
- `priceMinKes`
- `priceMaxKes`
- `annualMaintenanceKes`
- `includedDevices`
- `includedBranches`
- `features`
- `screenshots`
- `status`: live/beta/planned
- `sortOrder`

#### Leads

For visitors who are not ready to buy.

Fields:
- name
- phone
- WhatsApp
- email
- businessName
- county
- town
- businessType
- packageInterest
- currentSystem: paper/excel/generic-pos/cloud-pos/none
- painPoint
- source
- status: new/contacted/demo_booked/won/lost
- ownerNotes

#### DemoRequests

Fields:
- lead/customer
- packageInterest
- preferredDate
- preferredTime
- demoMode: WhatsApp/phone/remote/on-site
- status
- notes

#### CompetitorComparisons

CMS-driven compare pages.

Fields:
- slug
- competitorName
- competitorCategory
- comparisonRows
- positioningSummary
- sourceLinks
- published

#### HelpArticles

Better than using generic Pages for help.

Fields:
- slug
- title
- category
- packageScope
- body
- relatedArticles
- updatedAt

#### Pricing Global

Change from tiers to packages/add-ons:
- packages relationship/list
- extraDevicePrice
- extraBranchPriceMode
- maintenancePolicyCopy
- trialDays
- earlyAdopterOffer
- refundPolicySummary

## 7. Checkout plan

### First-time purchase

Routes:
- `/buy/dawa`
- `/buy/retail`
- `/buy/hospitality`
- etc.

Flow:
1. Visitor picks package.
2. Creates account or logs in.
3. Confirms business details.
4. Pays with Paystack custom UI.
5. Payment webhook creates customer/license/payment record.
6. Customer lands on dashboard with license key and installer.
7. Email sends receipt + setup steps.

### Renewal

Route:
- `/buy/renew/[licenseId]`

Flow:
1. Customer selects one-year maintenance renewal.
2. Pays.
3. `maintenanceUntil` extends.
4. Dashboard/download access updates.

### Add device/branch

Routes:
- `/buy/add-device/[licenseId]`
- `/buy/add-branch/[licenseId]`

Flow:
1. Customer requests add-on.
2. If price fixed, pay immediately.
3. If branch setup is complex, create quote/demo request instead.

## 8. Customer dashboard plan

Dashboard should answer immediately:

- Which package do I own?
- Is my maintenance active?
- What version can I download?
- Which devices are activated?
- Which branches are covered?
- How do I get support?
- What do I owe or need to renew?

### Dashboard cards

- Package: Omnix Dawa / Retail / etc.
- Maintenance: active/lapsed, days remaining.
- Devices: used/max.
- Branches: used/max.
- Latest version: installed/latest.
- Support: open tickets.

### License detail tabs

- Overview.
- Devices.
- Branches.
- Downloads.
- Payments.
- Maintenance.
- Support.

## 9. Owner admin plan

The owner admin should help run the business, not only edit CMS content.

### Required custom views

#### Sales pipeline

- New leads.
- Demo booked.
- Trials started.
- Won/lost.
- Conversion rate by package.

#### Trials

- Trials ending in 7 days.
- Trial usage health.
- Trial by module/package.
- Follow-up action buttons.

#### Revenue

- Revenue by package.
- Maintenance revenue.
- Device/branch add-on revenue.
- Monthly cash collected.
- Renewal forecast.

#### Module demand

- Most selected package interest.
- Most requested planned module.
- County/town demand map.

#### Installs map

- Machines by county.
- Active/lapsed/offline.
- Version distribution.

#### Support load

- Tickets by category.
- Tickets by package.
- Common setup problems.

## 10. Module pages

Each module page must sell a complete business system, not just list features.

### Standard module page template

1. Hero
   - Package name.
   - Exact audience.
   - Main promise.
   - CTA: Start trial / Book demo / WhatsApp.

2. Problem section
   - Local pain points.

3. Workflow section
   - How a normal day works in this module.

4. Feature proof
   - Screenshots and precise features.

5. Reports section
   - What owner sees daily/weekly/monthly.

6. Staff controls
   - Roles, permissions, audit trail.

7. Pricing pullout
   - Complete package price.

8. FAQ

9. CTA

### Required launch module pages

- `/modules/dawa`
- `/modules/retail`
- `/modules/hospitality`

### Planned-but-visible module pages

- `/modules/salon`
- `/modules/hardware`
- `/modules/workshop`

Planned pages should collect leads, not pretend the module is shipping.

## 11. Competitor comparison pages

Purpose: catch search intent and help buyers understand Omnix positioning.

Pages:
- `/compare/pharmasync`
- `/compare/cloud-pos`
- `/compare/restaurant-pos`
- `/compare/excel`
- `/compare/odoo`

Rules:
- Be factual, not insulting.
- Use public sources only.
- Include "best for" sections.
- Do not claim competitor outages/security problems unless sourced.
- Lead with Omnix strengths: offline, local data, Kenyan workflows, package pricing, maintenance model.

## 12. Help center plan

Help center is a support cost reducer.

Launch categories:

- Getting started.
- Licensing and activation.
- Devices and branches.
- Backup and restore.
- Payments and M-Pesa.
- eTIMS and tax.
- Users, roles, permissions.
- Dawa setup.
- Retail setup.
- Hospitality setup.
- Troubleshooting.

Required launch articles:
- Install Omnix on Windows.
- Activate your license.
- Start a free trial.
- Add another device.
- Add another branch.
- Renew maintenance.
- Restore from backup.
- Set up receipt printer.
- Set up M-Pesa/Paystack.
- Set up eTIMS.
- Create users and roles.
- Switch branch.
- What happens when maintenance expires.

## 13. Visual direction update

Keep the high-quality SaaS references, but avoid making Omnix look like a generic Silicon Valley clone.

Omnix should feel:
- serious
- operational
- local
- premium but practical
- high-trust
- screenshot-led
- not decorative

Rules:
- Real product screenshots over abstract illustrations.
- No purple/cyan gradients.
- No emoji-led marketing.
- No fake testimonials.
- No "trusted by 1000+" unless true.
- KES everywhere.
- M-Pesa, KRA, eTIMS, SHA only where relevant.

Visual assets needed before implementation:
- POS screenshot.
- Inventory screenshot.
- Settings/RBAC screenshot after built.
- Dawa workflow screenshot.
- Retail workflow screenshot.
- Hospitality screenshot can be designed later if module not built.
- License dashboard mock/screenshot.

## 14. Telemetry and privacy update

Rename all Duka telemetry language to Omnix.

Keep strict privacy promise:
- No customer names.
- No product names.
- No sale amounts.
- No patient data.
- No employee personal data.
- No prescription content.
- Only counts, versions, module/package, errors after sanitization.

Add telemetry fields:
- active package
- enabled modules
- maintenance status
- branch count
- device count

Admin should use telemetry for:
- support diagnostics
- version adoption
- install map
- crash trends
- integration setup health

Not for spying on business performance.

## 15. Implementation readiness checklist

Do not switch to implementation until these are done:

- Brand confirmed as Omnix in all website plans.
- Package pricing model approved.
- Exact launch packages selected.
- Payload collections revised for packages, leads, demo requests, help articles, comparisons.
- Routes approved.
- Checkout flow approved.
- Customer dashboard scope approved.
- Owner admin views approved.
- Visual direction approved.
- At least 3 real desktop screenshots selected or scheduled.
- Decision made on domain: current domain or new Omnix-specific domain.
- Decision made on trial behavior.
- Decision made on exact launch prices or ranges.

## 16. Recommended next steps

### Planning Batch A - Website doc correction

Rewrite or supersede docs:
- `01-mission-stack.md`
- `02-collections-data-model.md`
- `03-pages-and-dashboards.md`
- `06-acceptance-visual-bible.md`

Keep 04 and 05 mostly intact but rename Duka to Omnix and update package/license fields.

### Planning Batch B - Pricing finalization

Update:
- `docs/pricing-and-business.md`
- website Pricing global model
- module package cards

### Planning Batch C - Content outline

Write page-by-page copy outlines for:
- homepage
- pricing
- Dawa
- Retail
- Hospitality
- support/help
- book demo

### Planning Batch D - Data model final pass

Finalize Payload collections before scaffolding.

### Planning Batch E - Implementation switch

Only after A-D are done, switch to implementation mode and scaffold the website.

## 17. When to switch to implementation

Switch when this sentence is true:

> We know exactly what Omnix sells, how it is priced, what pages exist, what Payload collections store, how checkout creates licenses, and what the dashboard/admin must show.

Until then, building code will create rework.
