# v0.10.0 Marketing + Docs Rollout

How we explain what shipped to people who haven't bought yet. Plan only —
no copy is final, every page section here is a working draft we'll
refine in the implementation pass.

---

## 1. Who reads each page (so we know what to say)

The website serves three distinct audiences. Each one needs a different
shape of proof:

- **Cold visitor** lands on `/`, `/etims`, `/sha`, `/mpesa`, or a trade
  variant page from a Google search. They've never heard of Omnix.
  They want to know: *what is this, who is it for, can I trust it,
  what does it cost, can I try before I pay?*
- **Considering buyer** has been on the site before. They're comparing
  with QuickBooks, Sage, Loyverse, Vend. They want to see: *what's
  inside, what's actually different, what does the daily workflow
  look like, who's already using it, where do I get help.*
- **Existing customer / dashboard user** is logged in. They want
  *what's new since they last opened the app*, and a clean upgrade
  path. The /downloads page + the in-app update banner own this.

The v0.10 features fall on different audiences:

| Feature | Cold visitor cares? | Considering buyer cares? | Existing user cares? |
|---|---|---|---|
| 14 entity detail pages | Low | High (depth-of-feature) | High |
| 16 branded PDFs (VAT3, P9, P10, GRN, etc.) | Medium | **Very high** (compliance) | High |
| PO lifecycle (3-way match, approvals) | Low | High (audit/finance) | Medium |
| Customer display playlist | Medium (visual) | High | Medium |
| Onboarding wizard | High (lower friction) | Medium | n/a |
| CSV auto-map w/ Swahili | High (Kenya-friendly) | Medium | Low |
| Receive-stock from product detail | Low | Medium | High |
| BackButton + dead-end audit | Low | Low (polish) | Medium |
| P&L COGS bug fix | Low | Medium (correctness) | Medium |

Conclusion: the **PDF engine** + **PO compliance** + **onboarding** are
the cold-visitor sellers. Everything else is depth that rewards a
considering buyer who clicks through.

---

## 2. The story we want to tell

One sentence the homepage hero needs to land:

> "Omnix is the only Kenyan-built ERP that gives you a real, branded
> compliance pack — VAT3, P9, P10, eTIMS, SHA — out of the box, on a
> desktop app that works offline, for one fair price."

Three supporting pillars under that:

1. **Compliance done by default.** Every report you'll need to file
   (VAT3, P9, P10, GRN, controlled register) prints to PDF with your
   masthead in one click. Nobody else does this — competitors give
   you a CSV and tell you to format it yourself.
2. **Built for how Kenyan businesses actually work.** Multi-currency
   PO with three-way match. Approval thresholds for high-value orders.
   M-Pesa STK push at the till. Swahili column headers in your CSV
   import. Drug interaction checks for chemists.
3. **You own the install.** Desktop-first, offline-first. No SaaS
   lock-in. Per-machine licence. Your data lives on your computer,
   encrypted with SQLCipher, never on someone else's server unless
   you opt in to cloud backup.

The v0.10 release lets us back up pillar 1 with a download-a-real-PDF
demo. That's the highest-leverage marketing change here.

---

## 3. Page-by-page rollout

### 3.1 Homepage (`/[locale]/(frontend)/page.tsx`)

Current sections (already on page):
1. Hero
2. Receipt proof
3. Modules row
4. AI section
5. Compliance section
6. One price section
7. POS preview
8. Studios hand
9. Founder note
10. FAQ

Changes:

- **Hero** — keep the existing globalised lede behaviour. Add a sub-
  rail under the headline: *"Now with VAT3, P9, P10, GRN — every
  Kenyan filing as a one-click PDF."* Mono, 11px, foreground/60.
- **Compliance section** — currently lists eTIMS + SHA. Expand to
  include the new generated PDFs. Show a small grid of 6 PDF tiles
  (VAT3, P9, P10, GRN, Hardware Quote, Z-Report) with thumbnails and
  one-line descriptions. Each tile links to a sample PDF download
  (we generate these once and store them in `public/samples/`).
- **Receipt proof section** — already shows a thermal receipt. Add a
  second proof block below it: an A4 PDF preview (the engine masthead
  + a Z-Report sample) titled *"Reports too."* This visually proves
  point 1 of the story.
- **POS preview** — no change required.
- **AI section** — no change required.
- **Modules row** — link each module card to its variant landing
  (already done). Add a tiny "What's new in v0.10" sticker on Pro,
  Dawa, Retail, Hardware, Hospitality where the new features apply.
- **One price section** — refresh to mention "and every report PDF in
  your brand" as a bullet inside the licence package.
- **Founder note** — unchanged.
- **FAQ** — add 3 new entries:
  - *"Can I file VAT3 directly from Omnix?"* No, you still file on
    iTax — but Omnix gives you the populated VAT3 PDF in your
    company colours, ready to copy figures from.
  - *"Does it support multi-currency purchase orders?"* Yes, since
    v0.10. Stamps the FX rate at receipt time so cost-of-goods is
    correct in your books.
  - *"How does the customer display work?"* Plug a second monitor
    into the same machine. Omnix opens a separate Tauri window on
    it. Configure idle-screen slides (images, videos, iframes) from
    Settings → Customer Display.

Implementation notes:
- New file: `website/src/components/landing/pdf-pack-section.tsx` —
  the 6-tile PDF grid component.
- Asset pipeline: a new `scripts/generate-sample-pdfs.ts` that runs
  the desktop renderers with synthetic data and writes 6 PDFs to
  `public/samples/`. Re-run on every release.
- One unit test asserting each sample PDF exists and starts with the
  `%PDF-` magic bytes.

### 3.2 Pricing (`/[locale]/(frontend)/pricing/page.tsx`)

Current: shows the one-price KES 30,000 + KES 12,000/year structure.

Changes:

- Add a "What's actually included" expandable list under the price.
  Group by category:
  - Core (POS, inventory, customers, suppliers, accounting)
  - Compliance pack (eTIMS sale signing, VAT3 PDF, P9/P10 PDFs,
    GRN, controlled register PDF)
  - Procurement (mixed-currency PO, three-way match, approval
    workflow, reverse-GRN)
  - Reports (P&L, day book, aged AR/AP, top products, dead stock,
    Z-report, all branded PDFs)
  - Customer display
  - Module add-ons (Dawa, Retail, Hardware, Hospitality)
- Keep the global / KES dual price (already locale-aware).
- Add a small "v0.10 highlights" sidebar listing the 4–5 biggest new
  things, each linking to their relevant module/feature page or to
  the changelog.

### 3.3 Module pages (`/[locale]/(frontend)/modules/[slug]/page.tsx`)

There are 5 module slugs: `dawa`, `retail`, `hardware`, `hospitality`,
`pro`. Each currently has a hero + feature list + CTA.

Changes per module:

- **Dawa**: emphasise the controlled-substances register PDF (new in
  v0.10). One-line: *"Daily controlled-substances register, signed
  off in your pharmacy's name, ready for the Pharmacy & Poisons
  Board inspection."*
- **Retail**: emphasise stock-take variance PDF + dead stock + reorder
  list — branded outputs for chains running multi-branch ops.
- **Hardware**: emphasise the new branded Hardware Quote PDF (with
  bulk discount + VAT lines). This is a near-direct competitive
  advantage vs Excel quotations.
- **Hospitality**: emphasise the existing recipe-cost engine + the
  Z-report at shift close (already shipped) — note the new branded
  format.
- **Pro**: emphasise the unified PDF report pack + multi-currency PO
  for service businesses dealing with foreign clients.

Each module page should get a "Detail page" screenshot showing the
new entity-detail layout (eyebrow + serif title + stat strip + tabs).
This is one of the most visually distinctive things v0.10 ships.

### 3.4 Compliance landings (`/etims`, `/sha`, `/mpesa`)

Current: Kenya-specific deep dives.

Changes:

- **eTIMS**: add a sub-section *"Once it's signed, here's what comes
  out"* showing the VAT3 PDF + an example signed-receipt thermal
  print + an aged-receivables PDF. Reinforces that the eTIMS sign-off
  isn't the end of the workflow — Omnix produces the filings.
- **SHA**: add a sample insurance-claims-batch PDF (we already render
  this — see `renderClaimsPdf`). Link to a one-click sample download.
- **M-Pesa**: keep mostly as-is. Mention that the Z-report breaks
  down M-Pesa, cash, and card receipts at shift close, with a thumbnail
  of the actual Z-report layout.

New page: **`/[locale]/(frontend)/payroll-pack/page.tsx`** — a
landing focused entirely on the P9 + P10 + payroll PDFs. This is a
huge selling point and currently has no dedicated page. Sketch:

```
Hero: "Your payroll, ready to file. Every month."
  P10 monthly batch · P9 yearly cert · M-Pesa salary export
  Sample PDFs + download

Section 1: How it fits in (calendar showing 9th P10, year-end P9)
Section 2: What's on each PDF (annotated screenshots)
Section 3: How filing works (Omnix → iTax workflow diagram)
Section 4: What it costs (a slice of the standard licence — no add-on)
Section 5: FAQ (NSSF, SHIF, Housing Levy, Affordable Housing)
CTA: "Try Omnix free for 30 days"
```

Wire this into the navbar under Compliance. Wire into the homepage
compliance section as a deep-dive link.

### 3.5 Downloads (`/[locale]/(frontend)/downloads/page.tsx`)

Current: per-variant download buttons + version label.

Changes:

- Add a "What's new in v0.10" callout box at the top of the page,
  pulling from the changelog. Three bullets:
  - 16 branded PDFs across compliance + reports
  - Purchase-order lifecycle hardening (mixed currency, approval,
    three-way match, reverse-GRN)
  - 14 entity detail pages + 7-step onboarding wizard
- Each bullet links to a relevant doc / module / sample.
- Show the actual installer file size + signed-by hash next to each
  variant button (for the security-conscious buyer).

### 3.6 Changelog (`/[locale]/(frontend)/changelog/page.tsx`)

Already exists, pulls from the `releases` table.

Changes:

- Update the per-release rendering to show "highlights" if the
  release has a `metadata.highlights` array. Backfill v0.10's
  highlights into the DB via a one-off SQL or a migration:
  ```sql
  UPDATE releases
     SET metadata = jsonb_set(
       coalesce(metadata, '{}'::jsonb),
       '{highlights}',
       '["16 branded PDFs", "PO lifecycle hardening", ...]'::jsonb
     )
   WHERE git_tag = 'v0.10.0';
  ```
- Add filters: All releases / Major releases / By module.
- Keep the "Subscribe to release notes" email opt-in already wired
  via the newsletter table.

### 3.7 Docs (`/[locale]/(frontend)/docs/page.tsx` + per-doc routes)

Current: `lib/docs-seed.ts` seeds docs. Many entries are still TODO
placeholders.

Changes:

- Replace the `lib/docs-seed.ts` placeholder content with real first-
  draft docs for the v0.10 features. Priority order:
  1. **Receiving stock** — manual receive vs PO-receive vs reverse-GRN.
     Concrete walkthrough with screenshots.
  2. **Purchase orders** — full lifecycle: draft → approved → sent →
     partial → received. Three-way match. Mixed currency.
  3. **VAT3 filing** — how Omnix populates VAT3, what to copy into
     iTax, how to reconcile.
  4. **P9 / P10 filing** — annual + monthly PAYE workflow.
  5. **Customer display setup** — second monitor + playlist + privacy
     mode per module.
  6. **Onboarding** — what each step asks for, what you can skip,
     where to change it later.
  7. **Reports** — every PDF, what it shows, when to use it.
  8. **CSV import** — including the Swahili header support.
- Each doc gets:
  - A 1-paragraph "what is this" lede
  - Step-by-step walkthrough
  - A "things to watch out for" list
  - A link to the related setting / page in the app
- New layout: side nav with doc tree, breadcrumb on the doc page,
  search bar (already exists in the docs index — wire it page-side).

### 3.8 Blog post: "What v0.10 means for Kenyan SMEs"

Optional but high-leverage. One long-form post that puts the release
in context. Outline:

```
1. Why we built v0.10 (the underlying problem: KRA filings are still
   a manual copy-paste nightmare for most SMEs)
2. The compliance pack — VAT3, P9, P10, GRN, controlled register
3. The PO lifecycle story — what changes when you have approval +
   three-way match + reverse-GRN
4. What this saves you per month (rough estimate: 8–12 hours
   formatting documents in Excel)
5. What's coming next (preview the next batch)
```

Tone: editorial, plain language, no marketing-speak. Target ~1500 words.

### 3.9 Variant landings (`components/marketing/variant-landing.tsx`)

The 5 variant landings (`/?variant=dawa`, `/?variant=retail`, …)
inherit shape from variant-landing.tsx. Add v0.10 highlights as a
distinct section near the bottom — same shape across all five, copy
varies per variant. Link to the new payroll-pack landing where
relevant (every variant uses payroll).

### 3.10 Footer + nav

Add a "What's new" link in the footer pointing at /changelog. Keep the
nav minimal.

---

## 4. Visual assets we need

The marketing changes above need real visuals. Producing them is the
biggest line item — we should prep them in parallel with copy.

| Asset | Format | Source | Used on |
|---|---|---|---|
| 6 sample PDFs (VAT3, P9, P10, GRN, Hardware Quote, Z-Report) | A4 PDF | Generated by `scripts/generate-sample-pdfs.ts` from real renderers | Homepage compliance section, Module pages, Downloads, Docs |
| Detail-page screenshot (Product) | PNG, light + dark | Run desktop in Tauri dev, capture | Module pages |
| PO 3-way-match dialog screenshot | PNG | Same | Module pages, Docs |
| Customer Display idle-playlist mockup | PNG | Same | Hospitality + Retail module pages |
| Onboarding wizard — step 4 + step 7 | PNG | Run website locally, capture | Homepage hero sub-rail, Docs onboarding |
| Calendar diagram for P10 / P9 filing | SVG | Hand-drawn in Figma + exported | Payroll-pack landing |
| Omnix → iTax workflow diagram | SVG | Same | Payroll-pack landing, Docs |

All assets land under `website/public/marketing/v0.10/` namespaced by
date so future releases can drop their own assets without colliding.

---

## 5. Copy guidelines (anti-slop)

Avoid:
- "Streamline your workflow", "Empower your business", "Game-changer",
  "Revolutionary", "Best-in-class", "Robust solution"
- Em-dashes, three-bullet "Faster, smarter, better" rhythms
- Em-fluff like "designed with care", "thoughtfully built", etc.

Prefer:
- Concrete claims with a number: "Every monthly P10 in 30 seconds, not
  3 hours." "16 PDFs, all in your masthead, all one click."
- Verb-first headings: "File VAT3 in your colours" beats "Beautiful
  VAT3 filing experience"
- Plain Kenyan English. Drop British/American hedges like "kindly",
  "perchance".
- Direct comparison where appropriate: "QuickBooks does X, we do Y"
  is allowed if Y is true.

Locale variants:
- All landing copy should pass the locale-aware path: Kenya users see
  "KES 30,000 one-time", non-Kenya users see "$X equivalent" with a
  caption explaining where the price was set.
- Compliance pages stay Kenya-pinned with a banner at the top:
  "Kenya-specific. If you're outside Kenya, see [Pro module]."

---

## 6. Sequence + rough schedule

Suggested batch order (smallest highest-leverage first):

1. **Homepage** — hero sub-rail, compliance section expansion,
   PDF-pack section, FAQ additions. ~½ day.
2. **Sample PDF generator** — generate 6 sample PDFs once + commit
   to public/. ~½ day.
3. **Pricing page** — what's-included list + v0.10 sidebar. ~2 hours.
4. **Module pages** — per-module v0.10 highlight + screenshot.
   ~½ day.
5. **Compliance landings** — sub-sections + sample PDF links.
   ~½ day.
6. **Payroll-pack landing** (new) — full new page. ~1 day.
7. **Downloads page** — what's new callout. ~2 hours.
8. **Changelog page** — highlights array + DB backfill. ~½ day.
9. **Docs rewrites** — 8 priority docs replacing TODOs. ~2–3 days.
10. **Blog post** — long-form release write-up. ~½ day.
11. **Variant landings** — v0.10 highlights row. ~½ day.

Total: ~7–9 working days for one author. We can parallelise screenshot
generation while drafting copy; that cuts roughly 2 days off the line.

---

## 7. What to defer

These would be useful but aren't critical for v0.10 sell-through:

- Translated landing pages beyond English (Swahili landing).
- Video demos (would help a lot — but production-heavy).
- Customer-quote testimonials (we don't have them yet at scale).
- A/B testing the new compliance section variants.

Capture them as `docs/plans/V0_11_MARKETING.md` after this batch lands.

---

## 8. Success metric

How we'll know this rollout worked:

- /pricing → /buy conversion stays flat or rises.
- Average session duration on /etims, /sha, /mpesa goes up by ≥10%
  (people are reading the new compliance proof).
- Onboarding completion rate (signups that finish the wizard) ≥80%
  (was untracked before — set the baseline now).
- Sample-PDF download events on the homepage ≥5% of unique sessions.
- Support tickets asking *"do you generate VAT3?"* drop to near zero
  within 2 weeks of launch.

These are tracked via the existing telemetry pipeline plus a new
client-side event for sample-PDF downloads.
