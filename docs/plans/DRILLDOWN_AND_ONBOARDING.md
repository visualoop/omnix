# Drill-down architecture + onboarding flow

**Status:** plan only — no code yet.
**Spans:** website admin + customer dashboard + desktop app.
**Why:** every list view today is a flat row dump; clicking a row
either opens an edit dialog or does nothing. We need real entity
pages that let an admin (or a customer, scoped to their data) see
everything about one user, one org, one machine, one product, one
sale, etc. Also: missing onboarding flow that captures org details
when a buyer signs up.

---

## Audit of what's missing today

### Website — admin side (signed-in as `platform_admin`)

| Surface | Today | What's missing |
|---|---|---|
| `/admin/users` | flat list of every account | clicking a row opens nothing → need `/admin/users/[id]` detail |
| `/admin/orgs` | list with member + machine counts | no `/admin/orgs/[id]` |
| `/admin/machines` | grid of CRT cards | no `/admin/machines/[id]` |
| `/admin/licenses` | paper-card grid + delete | no `/admin/licenses/[id]` |
| `/admin/payments` | kanban | no `/admin/payments/[id]` |
| `/admin/tickets` | kanban | no `/admin/tickets/[id]` |
| `/admin/audit` | feed | each row's `metadata` jsonb is hidden — need an inline expand or `/admin/audit/[id]` |
| `/admin/team` | staff roster | no per-member history |

### Website — customer dashboard side (signed-in as `user`)

| Surface | Today | What's missing |
|---|---|---|
| `/dashboard` | start-trial wizard or licences/machines summary | OK |
| `/dashboard/licenses/[id]` | exists — audit completeness | machines bound to it, payment history, status timeline |
| `/dashboard/machines/[id]` | exists — audit completeness | sales-volume chart, telemetry rollups, cloud-backup status |
| `/dashboard/payments` | list | no `/dashboard/payments/[id]` |
| `/dashboard/support/[id]` | exists — audit thread shape | conversation thread completeness |
| `/dashboard/team` | **doesn't exist** | customer-side org member management (different from platform `/admin/team`) |
| `/dashboard/profile` | exists — basic | needs phone, business name, KRA PIN, country, default currency |
| Sign-up | magic-link only | no onboarding wizard for org details |

### Desktop app — inventory + adjacent

| Surface | Today | What's missing |
|---|---|---|
| `/inventory` | flat product list | clicking name opens edit drawer → should open full detail |
| `/inventory/[id]` | doesn't exist | comprehensive product page (variants, images, history, suppliers, batches, low-stock warnings) |
| `/customers` | flat list | clicking name → no detail page; need full customer history |
| `/suppliers` | flat list | clicking name → no detail page; PO history, payment terms, contact log |
| `/sales` | flat list | clicking sale # → no comprehensive receipt + payment events + reverse/refund flow |
| `/purchases` | flat list | clicking PO → no detail (line items, GRN status, supplier-side payments) |
| `/employees` | flat list | clicking name → no detail (shifts, payroll history, P9 export) |
| `/branches` | flat list | clicking branch → no detail (machines, daily sales, branch-specific settings) |

### Cross-cutting concerns
- **Breadcrumbs** + a "Back to list" link on every detail page
- **Tabbed sub-sections** (Overview / History / Activity / Notes) so detail pages don't dump everything at once
- **Lazy-load heavy tabs** (sales history charts, audit feeds) so initial render is fast
- **Permission gates** — customers see only their own data; admins see all
- **Search inside lists** before clicking through (a fuzzy filter so 500-row tables stay usable)
- **Print + export** — detail pages should support a "Print" button (PDF receipt for a sale, full customer card, etc.)

---

## Phases

### Phase A — Website admin drill-downs (server-rendered detail pages)

8 detail pages. Each follows the same pattern: a hero section with
the entity's identity + status + primary actions, then tabbed
sub-sections.

| Route | Hero | Tabs |
|---|---|---|
| `/admin/users/[id]` | name, email, role, banned chip, country, business name, joined-on | Overview · Licences · Machines · Payments · Tickets · Audit |
| `/admin/orgs/[id]` | org name, slug, owner, members count, machines count, lifetime revenue | Overview · Members · Licences · Machines · Payments · Audit |
| `/admin/machines/[id]` | hostname, status LED, OS, version, location, license-bound info | Overview · Telemetry · Heartbeat history · Cloud backups · Audit |
| `/admin/licenses/[id]` | key, variant, tier, status, expiry, owner | Overview · Machines · Payments · Audit |
| `/admin/payments/[id]` | reference, amount, status, paystack response | Overview · Webhook events · Audit |
| `/admin/tickets/[id]` | subject, priority, status, customer | Conversation · Internal notes · Audit |
| `/admin/audit/[id]` | action, actor, target | Detail (full metadata) · Related events |
| `/admin/team/[id]` | staff name, role, avatar | Overview · Recent actions · Audit |

Acceptance per route:
- Returns 200 for any valid id
- Returns 404 for unknown id
- Hero shows quick-action buttons (Ban / Unban, Promote, Refund, Resend invite, etc.)
- Tabs lazy-load
- Every tab can be deep-linked (`?tab=machines`)
- Page renders a skeleton while loading

### Phase B — Customer dashboard drill-downs

| Route | Status | Plan |
|---|---|---|
| `/dashboard/licenses/[id]` | exists | audit + add: machines bound, payment events for this licence, add-on history |
| `/dashboard/machines/[id]` | exists | audit + add: 30-day sales volume chart, cloud-backup status, peer LAN list |
| `/dashboard/payments/[id]` | new | receipt + retry / refund / re-send invoice |
| `/dashboard/support/[id]` | exists | audit conversation rendering |
| `/dashboard/team` (NEW) | new | invite teammates as org members (NOT staff). Org plugin already wired in Better Auth. |
| `/dashboard/profile` | exists | extend with phone, business name, KRA PIN, country, default currency, profile photo |

### Phase C — Sign-up onboarding wizard

Today: magic-link → `/dashboard` straight into the trial wizard.

Better: a first-run wizard that collects org details before
committing the trial. Skippable at any step except the email + name
(magic-link already gives us email).

```
Step 1 — Welcome
  "Hi {first name}. Two minutes to set this up."

Step 2 — Your business
  Business name [_______]
  Country [Kenya ▾]   ← geo-defaulted
  Currency [KES ▾]    ← derived from country

Step 3 — How big is the team?
  ○ Just me
  ○ 2 – 5
  ○ 6 – 20
  ○ 20 +
  → drives the maxBranches + maxMachines hint on the licence

Step 4 — Contact (optional)
  Phone (international format)  [________________]
  KRA PIN (Kenya only)          [________________]

Step 5 — Pick your trade
  (the existing StartTrialWizard variant picker)

Step 6 — Done
  Show the licence key + download links + activation steps
```

Persistence:
- Steps 1–4 update the Better-Auth `user` row (additionalFields:
  phoneNumber, businessName, country, currency)
- Step 3 also creates a `organization` row with the same name +
  the user as owner-member
- Step 5 → `/api/dashboard/trial`
- Step 6 → land on `/dashboard`

Wizard state lives in URL search params so back/forward works
and the user can bookmark / resume. We do NOT store wizard progress
in DB — sign-in is so fast that resuming on cold start is fine.

### Phase D — Desktop product detail page

Replace the current "click name → edit dialog" pattern with
"click name → `/inventory/<id>` detail page; click pencil → edit
dialog stays."

Detail page layout:

```
┌─ Hero ───────────────────────────────────────────────────────┐
│  Image grid (4 thumbnails)        Panadol Extra 500mg        │
│  ┌────┬────┐                      Pharmacy · Painkillers     │
│  │    │    │   [Edit] [Print]     SKU 4711-PNDX-500          │
│  │    │    │   [Restock] [Move]                              │
│  ├────┼────┤                      Stock 247                  │
│  │    │    │                      Avg sale 8.4 / day         │
│  │    │    │                      Last sold 12 min ago       │
│  └────┴────┘                                                 │
│                                                              │
│  KSh 120 retail · KSh 92 cost · 30% margin                   │
└──────────────────────────────────────────────────────────────┘

[Overview] [Variants] [Stock] [Sales] [Suppliers] [Batches] [Notes]

  Variants tab
  ────────────
  500MG · 30 TABS · KSh 120  (default)
  500MG · 60 TABS · KSh 220
  1000MG · 12 TABS · KSh 80
  + Add variant

  Stock tab
  ─────────
  Branch        On hand   Reorder   Last counted
  Westlands     247       50        12 May
  Kasarani      54        50        13 May
  Eldoret       128       50        09 May
  + Move stock between branches

  Sales tab
  ─────────
  Last 30 days: KES 84,200 across 412 sales (sparkline)
  Top buyers: Kibera High School (84 units), ...
  By branch / by hour heatmap

  Suppliers tab
  ─────────────
  Last buy: 14 May from Beta Healthcare · KES 92/unit
  Buy history: 12 POs over last 12 months
  Average lead time: 6 days

  Batches tab (Dawa/Pharmacy only)
  ────────────────────────────────
  BATCH#   QTY   EXPIRY     SUPPLIER       LOT
  PND-123  100   2027-08    Beta Healthcare 84A91
  PND-124  150   2027-12    Pharmaplus      85B07
  ...

  Notes tab
  ─────────
  Free-text staff notes (e.g. "Don't sell with codeine combo")
  Editable inline.
```

Edits flow:
- The pencil button on any field opens the existing edit drawer
- "Restock" opens the stock-receive flow
- "Move" opens the stock-transfer dialog
- Image upload works inline (drag-and-drop into the grid)

### Phase E — Other desktop drill-downs

Same pattern, applied to:

| Entity | Hero | Tabs |
|---|---|---|
| Customer | name, phone, email, address, lifetime spend, KRA PIN | Overview · Sales · Receivables · Notes |
| Supplier | name, contact, payment terms, lifetime owed | Overview · POs · Payments · Communication log · Notes |
| Sale | receipt #, total, status, payment method | Receipt · Payments · KRA filing · Refunds |
| PO | PO #, status, supplier, expected date | Lines · GRN · Payments · Communication |
| Employee | name, role, branch, hire date | Overview · Shifts · Payroll · P9 history |
| Branch | name, manager, address | Overview · Machines · Daily summary · Settings |

---

## Tasks (each row = one PR)

These get added to the master task tracker.

### Website
1. Build `/admin/users/[id]` with 6 tabs
2. Build `/admin/orgs/[id]` with 6 tabs
3. Build `/admin/machines/[id]` with 5 tabs
4. Build `/admin/licenses/[id]` with 4 tabs
5. Build `/admin/payments/[id]` with 3 tabs
6. Build `/admin/tickets/[id]` with 3 tabs (conversation thread)
7. Build `/admin/audit/[id]` (full metadata expand)
8. Build `/admin/team/[id]` (recent actions)
9. Audit + extend `/dashboard/licenses/[id]`
10. Audit + extend `/dashboard/machines/[id]`
11. Build `/dashboard/payments/[id]`
12. Build `/dashboard/team` (org member management for customers)
13. Extend `/dashboard/profile` (phone + KRA PIN + business name)
14. Build the 6-step sign-up wizard with persisted org row
15. Add breadcrumbs primitive used by all detail pages
16. Add tab-deeplink helper (parses ?tab=)
17. Add lazy-tab loader primitive (Suspense + skeleton fallback)
18. Add fuzzy-search input on `/admin/users`, `/admin/machines`, etc.

### Desktop
19. Build `/inventory/[id]` with 7 tabs (Phase D in full)
20. Build `/customers/[id]` with 4 tabs
21. Build `/suppliers/[id]` with 5 tabs
22. Build `/sales/[id]` (real receipt detail + refund flow)
23. Build `/purchases/[id]` with 4 tabs
24. Build `/employees/[id]` with 4 tabs
25. Build `/branches/[id]` with 4 tabs
26. Replace "click name → edit drawer" with "click name → detail
    page; click pencil → edit drawer" across every list view
27. Add desktop-side breadcrumbs primitive
28. Add desktop-side tab system (lazy-loaded panels)

### Cross-cutting
29. Add a `useEntityHistory(entityType, id)` hook that aggregates
    audit-log + sales + payments for any entity into one feed
30. Add `EntityCard` primitive — reusable hero block (image, name,
    status chip, primary actions) used by every detail page

---

## Phasing

**Sprint 1 (1 week)** — primitives + fastest-impact admin pages
- Tasks 15, 16, 17, 30 (primitives)
- Tasks 1, 2, 3 (`/admin/users/[id]`, `/admin/orgs/[id]`, `/admin/machines/[id]`)
- Task 14 — sign-up wizard (high impact for new buyers)

**Sprint 2 (1 week)** — remaining admin + customer dashboard
- Tasks 4, 5, 6, 7, 8 — admin licences/payments/tickets/audit/team
- Tasks 9, 10, 11, 12, 13 — dashboard side
- Task 18 — fuzzy-search

**Sprint 3 (1 week)** — desktop drill-downs (the big lift)
- Tasks 27, 28 — desktop primitives
- Task 19 — inventory detail (most-used screen)
- Tasks 22, 23 — sales + purchases detail (revenue + procurement
  visibility)

**Sprint 4 (3-4 days)** — remaining desktop drill-downs
- Tasks 20, 21, 24, 25, 26 — customers, suppliers, employees,
  branches, list-view click rewiring

Total: ~3.5 working weeks for one engineer. Most of the value (admin
drill-downs + sign-up wizard + inventory detail) lands in the first
two sprints.

---

## What this plan explicitly does not do

- **Doesn't change the schema.** Every detail page reads from existing
  tables. New columns (e.g. profile photo, KRA PIN) get added as
  optional with sensible defaults; no breaking migrations.
- **Doesn't introduce a search index** like Algolia / Meilisearch.
  Postgres / SQLite full-text search is enough at our scale (<100k
  customers per business).
- **Doesn't ship analytics.** Charts on detail pages aggregate live
  query results; we'll consider a daily-rollup table only when query
  performance warrants it.
- **Doesn't ship audit-log redaction.** Sensitive fields (license
  keys, payment refs) appear in admin audit feeds today; that's
  intentional — admins need them. Customer-side audit is scoped per
  user already.

End of plan. Awaiting greenlight before any code is written.
