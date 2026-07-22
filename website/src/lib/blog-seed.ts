/**
 * Seed blog posts — used until the owner uploads to the Payload BlogPosts collection.
 * Each post is fully editorial-quality; the owner replaces these one at a time.
 */

export interface BlogPostSeed {
  slug: string
  title: string
  excerpt: string
  category: 'product' | 'industry' | 'tutorial' | 'announcement'
  author: string
  publishedAt: string // YYYY-MM-DD
  readTime: number // minutes
  body: string // markdown-style plain text — rendered with simple paragraph parser
  featured?: boolean
}

export const POSTS_SEED: BlogPostSeed[] = [
  {
    slug: 'offline-first-architecture',
    title: 'What offline-first means in Omnix',
    excerpt:
      'A practical account of which Omnix records stay on the Windows device, which tasks need connectivity, and how the desktop boundary works.',
    category: 'product',
    author: 'Omnix',
    publishedAt: '2026-07-21',
    readTime: 4,
    featured: true,
    body: `Omnix is a Windows desktop application. Its operational database is SQLite and lives on the device, so the core records used at the counter do not depend on a browser session or a hosted web database.

## What stays on the device

Sales, stock, customers, suppliers, purchasing, accounting records, and the enabled trade module use the local desktop database. The application reads and writes those records locally during normal operation.

## What still needs connectivity

Some services cross the desktop boundary: initial licence activation, software updates, configured digital-payment requests, eTIMS submission, SHA or insurer exchanges, email delivery, and optional remote backup. Each of those depends on the relevant provider, credentials, and an internet connection. A provider outage does not turn the local database into a cloud dependency.

## One installation, one business

A licensed installation is for one business on its Windows device. Where a business uses supported same-network devices, they connect through the product's LAN workflow rather than a public multi-tenant database.

## The commercial boundary

The Windows licence costs KES 30,000 once and remains perpetual. Annual compliance updates cost KES 12,000 and are optional; not renewing them does not deactivate the perpetual licence. A demo is the right place to confirm the product, hardware, provider, and compliance setup for a particular business.`,
  },
  {
    slug: 'omnix-rebrand',
    title: "We're Omnix now",
    excerpt:
      "After two years as SokoOS, we're settling on a name that reflects what we've become — one platform for every Kenyan trade. Here's why, and what changes for current customers.",
    category: 'announcement',
    author: 'Justin, founder',
    publishedAt: '2026-05-15',
    readTime: 3,
    featured: true,
    body: `We tried "SokoOS" for two years. It started life as a nickname between the founder and the first three customers. As we grew it stopped working: people couldn't pronounce it, it sounded vaguely techy in a way that put off the mama-running-three-branches who was supposed to feel at home, and it didn't capture what the product had become.

Because we're no longer one thing. What began as pharmacy software now runs mini-marts, hardware shops, restaurants and bars — the same Omnix Core underneath, with a trade-specific module on top. One platform, many verticals.

Omnix says exactly that. "Omni" — all of it, one system for every counter in the country. It's short, it's easy to say, and it doesn't box us into a single trade the way a pharmacy-flavoured name would.

Nothing changes for existing customers. Same licence keys, same desktop app, same auto-updates. The desktop app got a new wordmark and that's the most visible change you'll see. Your KRA filings, M-Pesa reconciliation, and SHA claims work exactly the way they did yesterday.

The website now lives at omnix.co.ke. Old links keep working — both reach the same place.

Welcome to Omnix.`,
  },
  {
    slug: 'kra-etims-2026-checklist',
    title: 'KRA eTIMS in 2026 — what you need to know',
    excerpt:
      'KRA flipped a few rules around eTIMS in early 2026. Here are the changes that affect Kenyan SMEs day-to-day, and what Omnix does about them automatically.',
    category: 'industry',
    author: 'Justin, founder',
    publishedAt: '2026-04-22',
    readTime: 6,
    body: `KRA quietly tightened a few eTIMS rules in early 2026. If you run a small business, here's what actually changed and what you have to do.

First the headline: VAT-registered businesses turning over more than KES 5 million per year now have a hard 24-hour ceiling on how late an eTIMS receipt can be issued after a sale. The old "ish" tolerance that everyone used while figuring it out is gone.

If you're using a manual receipt printer plus an Excel file you bulk-upload at end of day, that flow no longer holds. The receipts have to be issued in real time at the till — same minute the customer pays — or KRA's system will flag and ultimately disallow the sale's input VAT for your supplier later.

Second: the receipt format gained two new fields. Buyer KRA PIN (was optional, now required for B2B sales above KES 30,000). And the receipt must include a QR-code link to the eTIMS verification page so the customer can verify legitimacy on their phone.

What Omnix does automatically:
- Receipts issue at the till the same second the customer pays. There's no batch upload step.
- KRA PIN field on the customer record auto-populates when present and warns the cashier on B2B sales above the threshold.
- QR-code generation is built into the receipt template — no separate step.

What you still have to do:
- Add your KRA PIN to the company profile if you haven't already.
- For B2B sales, ask the customer for their KRA PIN at the till. Omnix prompts you above the threshold.
- File your monthly VAT return as before; eTIMS doesn't replace iTax, it feeds it.

If you're not on Omnix yet, talk to whatever software you use about real-time receipt issuance. If they batch-upload, you have a problem.`,
  },
  {
    slug: 'multi-branch-payroll-ke',
    title: 'Multi-branch payroll in Kenya without losing your mind',
    excerpt:
      "Running staff across 3 branches with NHIF/SHA + NSSF + PAYE used to mean a Saturday at your desk. Here's how the multi-branch payroll module compresses it to ten minutes.",
    category: 'tutorial',
    author: 'Justin, founder',
    publishedAt: '2026-04-08',
    readTime: 8,
    body: `If you're running a small chain — three pharmacies, four mini-marts, two salons — payroll month is the part of the month nobody enjoys. Each branch tracks its own staff, attendance lives in someone's WhatsApp group, NHIF/SHA forms have to be reformatted, and the bank file has to be assembled from spreadsheets.

We built multi-branch payroll for the customer who finally lost a Saturday to it and threatened to quit. Here's the workflow, step by step.

**Setup, once.** Add each branch and assign staff to them. Set commission and overtime rules per role. Configure your statutory rates (NSSF tier I and II, NHIF/SHA per band, PAYE). Configure your bank for direct debit (Equity, KCB, Co-op all work).

**Monthly, ten minutes.** Open Payroll → Run for May. Omnix pre-fills attendance from the time-clock module (or you import a CSV). Adjust the few rows that need fixing — overtime exceptions, mid-month joiners, leave settlement. Click Calculate. Review the variance against last month. Click Approve.

The output is three files: a bank batch CSV ready to upload to your business banking portal, a NHIF/SHA-formatted XML, and an NSSF Tier I + II batch. P9, P10 and PAYE filings are generated for the next month's iTax submission.

**What you don't have to do anymore.** Reformat statutory forms. Manually calculate per-branch commission splits. Re-key bank batches. Cross-check that the Saturday and Sunday hours got the right multiplier.

**Honest caveat.** First-time setup takes about 2 hours per branch — you have to enter staff, contracts, and statutory bands. That's a one-time cost. After that, every month is ten minutes.

Multi-branch payroll is part of the Omnix licence — one KES 30,000 one-time purchase per device, with no separate tier or upgrade to unlock it.`,
  },
  {
    slug: 'offline-first-why',
    title: 'Why we built Omnix offline-first',
    excerpt:
      "The internet drops. Power flickers. The till has to keep running. Here's how the desktop app handles it — and why it'll never become a SaaS web app.",
    category: 'product',
    author: 'Justin, founder',
    publishedAt: '2026-03-19',
    readTime: 5,
    body: `Two years ago, on a Tuesday, the customer who would become our first paying user lost their Safaricom internet for forty-three minutes during the lunch rush. They had three cashiers ready to ring up sales. The web-based POS they were trialling refused to do anything without the connection.

That's the day we decided to build a desktop app instead of a web app.

Offline-first is not a marketing line for Omnix. It's the architecture. The desktop binary ships SQLite, your full database lives on your machine, every query is a few microseconds away, and a network drop is a non-event for the cashier. When the internet comes back, sync happens in the background.

This costs us things. Our update story is harder — we have to ship a real installer with code-signing and an auto-updater, not just push a deploy. Our cross-device collaboration is harder — we have to run a master/client topology over LAN with conflict resolution, not just rely on a server. Our audit story is harder — we have to be sure no sensitive data leaks through the diagnostic telemetry channel.

But the user experience is on a different planet. Sub-300ms sale completion. Zero loading spinners. Working through a power cut on a UPS for as long as the UPS holds. Working through a Safaricom outage indefinitely. Closing a Z-report at the till with no anxiety about whether the day's data will survive the hand-off.

We won't add a "cloud version" that hosts the database centrally. The trade-off isn't worth it. What we will keep adding is better synchronisation — branch-to-branch, owner's-phone-to-till, encrypted nightly backup to R2. Synchronisation across devices that all hold their own copy of the data is the right pattern for Kenya.

The infrastructure of the country isn't ready for cloud-only software. Maybe it never needs to be.`,
  },
  {
    slug: 'hardware-hospitality-shipped',
    title: 'Hardware and Hospitality are here',
    excerpt:
      'Two new modules ship with Omnix: Hardware (quotations, contractor accounts, deliveries) and Hospitality (restaurant + hotel). Here is what they do.',
    category: 'product',
    author: 'Justin, founder',
    publishedAt: '2026-03-04',
    readTime: 4,
    body: `When we shipped Core, Dawa, and Soko Retail, two trades kept asking for more: hardware shops that live on quotations and contractor credit, and restaurants and small hotels that need a real kitchen-and-rooms workflow. Both are now live, on the same Core, unlocked per licence.

**Hardware.** Build a quotation, send it, and convert it to a sale in one click when the customer commits. Delivery notes track dispatch with vehicle and driver. Contractor accounts carry credit limits, running balances, and aged receivables (current / 30 / 60 / 90+). Tiered pricing means contractors and walk-ins see the right price automatically, and sales commissions accrue per salesperson on every sale.

**Hospitality.** A table floor plan by area, an order lifecycle that runs from open through sent-to-kitchen to served, and a kitchen display grouped by station with a bump button. Service charge and tips are tracked separately from revenue and allocated to staff. For places with rooms: room types, bookings, check-in that opens a folio, restaurant charges posted to the room, and a check-out that requires a settled balance. Recipe costing shows food-cost %, and the reports cover occupancy, ADR, and RevPAR.

Both modules are perpetual — pay once, own them forever. They unlock only on a licence that includes them, so you only pay for the trades you run.

If you run a vertical we haven't built yet — agro-vet, fuel station, butchery, school — make a noise about it. We pick what to build next based on what real customers ask for.`,
  },
  {
    slug: 'sha-transition-guide',
    title: 'SHA replaced NHIF — what changed for your billing',
    excerpt:
      'Kenya replaced NHIF with the Social Health Authority in late 2024. The claim formats changed, the bands changed, and your software has to change with them.',
    category: 'industry',
    author: 'Justin, founder',
    publishedAt: '2026-02-12',
    readTime: 7,
    body: `The Social Health Authority replaced the National Hospital Insurance Fund in late 2024 as part of the Universal Health Coverage rollout. If you bill insurance in your business — pharmacy dispensing, clinic visits, hospital out-patient — the practical changes affect your day-to-day workflow.

**The rate bands changed.** The old NHIF flat-rate-by-salary system is gone. SHA uses a tiered contribution that scales with declared income. Employers calculate and remit per the new schedule.

**The claim format changed.** SHA introduced a new XML format with additional fields (ICD-10 diagnosis code, procedure code per service, prescriber HCP number). Old NHIF claim files no longer submit cleanly.

**The provider numbering changed.** Existing NHIF provider codes were migrated to new SHA codes — most were preserved with a prefix change, but some facilities got new numbers entirely.

**What Omnix updated automatically (in v0.1.6, February 2026):**
- New rate band table for SHA contributions
- New XML claim format
- Mapped your old NHIF provider code to the new SHA code (one-time auto-migration on first launch)
- Added ICD-10 selector to dispensing module so the diagnosis code populates the claim
- Updated the payroll deduction line to read "SHA" not "NHIF"

**What you still have to do:**
- Verify your facility's SHA code matches the migration. Most do; check via the SHA web portal once.
- Train your dispensing staff to enter the diagnosis code when claiming insurance. The first few weeks will be slower; it becomes automatic.
- Re-register any private insurance schemes that piggy-backed on NHIF (AAR, Jubilee, Britam, Madison) — most have their own SHA-aligned forms now.

**Tip:** Keep the patient's old NHIF number on file even after migrating. Some bigger employers still reference it in HR records and claims data.

If you're moving from a competitor's software that hasn't updated for SHA, you have a problem in the order of weeks not months — claims will start failing.`,
  },
  {
    slug: 'v0-10-what-it-means',
    title: 'What v0.10 means for Kenyan SMEs',
    excerpt:
      'Sixteen branded PDFs. Mixed-currency POs. A purchase-order workflow that finally matches how Kenyan finance offices actually work. Here\'s what changed and why.',
    category: 'announcement',
    author: 'Justin, founder',
    publishedAt: '2026-06-24',
    readTime: 7,
    featured: true,
    body: `Today's release is the biggest single jump Omnix has shipped. Not in feature count — in the proportion of work it lifts off the people who run the business at the end of every month.

The summary: every Kenyan tax filing now prints to a branded PDF in one click, the purchase-order flow has been rebuilt to handle mixed currency and three-way match, customer profile pages got their own dedicated views, and onboarding shrank from "talk to support" to a 7-step wizard you finish before your tea cools.

## Why we did this

Three months of customer interviews kept landing on the same complaint: "the software is good but my accountant still spends a Saturday formatting Excel into something KRA accepts." We weren't doing the last mile.

The KRA filings are the most obvious example. Every Kenyan business that registers for VAT, PAYE, and SHIF is on the hook for at least three monthly returns and one annual one. Most software up to v0.10 stopped at "here's a CSV, you figure it out from here." The accountant then opened it in Excel, formatted columns to match the iTax form, fixed two cells that wouldn't sum, exported to PDF, emailed it to themselves, and copied figures into iTax line by line.

That's eight to twelve hours of cognitive overhead per month per business. We watched it happen, recorded the time, and rebuilt the layer that sits between "here's a number" and "ready to file."

## What changed in v0.10

**Compliance pack** — VAT3, P9 yearly tax certificate, P10 monthly PAYE batch, controlled-substances register, and the full operations cluster (day book, Z-report, aged AR/AP) all generate to branded PDFs now. Same masthead. Same currency formatting. Same layout language. You learn one, you know all sixteen.

The format is intentional. We don't try to file directly with KRA — iTax doesn't expose that API to third parties anyway, and we don't trust soft assurances that it will. We populate the form, format it the way the iTax web UI expects to see it, and let you copy across in five minutes instead of fifty.

**Purchase orders** — finally a complete state machine. A PO can be in draft, pending approval, approved, sent, partial receipt, fully received, paid, or cancelled. The approval threshold is configurable (default KES 100,000); above it the PO must transit through approval before being sent. Three-way match runs at payment time — PO total, GRN total, supplier invoice total all need to align within tolerance. If they don't, you reverse the GRN, fix the discrepancy, and try again.

Mixed currency was the other big change. Kenyan businesses that buy from China or Europe have been doing manual currency conversion in spreadsheets for years. Now you set the PO currency at creation, the exchange rate snapshots at goods-receipt time, and the books record cost-of-goods in your base currency at the rate you actually paid. The PO itself stays in foreign currency for the audit trail.

**Customer display** — the second-monitor display now supports an idle playlist. While the till is empty, rotate through promo images, YouTube embeds, or arbitrary iframe URLs. Configure from Settings → Customer Display.

**Detail pages** — every record (product, customer, supplier, sale, employee, branch) now has its own page with tabs for related history. Where before clicking a product opened a slide-out, now you get a dedicated page with overview, stock, sales, suppliers, and activity tabs. Easier to share, easier to bookmark, easier to find your way back to a year-old transaction.

**CSV import** — auto-mapping for English and Swahili headers. Drop in a CSV with "Bei ya Kuuza" instead of "selling_price"; Omnix figures it out. We tested against 21 different naming conventions; the test suite locks them in so no future change can regress them.

## The bug we fixed

We also caught a real one: P&L gross-profit was equal to revenue when sale items had no batch_id. The COGS fallback chain wasn't firing. This affected any retail or hardware sale where stock was received without an explicit batch (most of them). If you've been wondering why your P&L looked too good — that's why. v0.10 fixes it; we'd recommend regenerating last month's P&L now to see the corrected figures.

## What it costs

Nothing extra. v0.10 lands as part of the standard licence, free to anyone on active maintenance.

## How to upgrade

Open Omnix → Settings → Updates → Check now. The update downloads and installs on next restart. Your data is unchanged.

## What's coming

We've started on the next batch:
- Mobile companion app for owners (read-only access to sales + alerts)
- AI receipt-to-supplier-invoice matching
- Per-employee leave + attendance reporting

If you have a feature you've been waiting for, the fastest way is to email **founder@omnix.co.ke** — every customer email goes to my inbox.

— Justin`,
  },
] as const

/**
 * Explicit editorial publication gate. Legacy seeds remain available for
 * rewrite, but they cannot render, generate static params, or enter the
 * sitemap until their slug is deliberately reviewed and added here.
 */
const PUBLISHED_BLOG_SLUGS = new Set<string>(['offline-first-architecture'])

export function publishedPosts(): BlogPostSeed[] {
  return POSTS_SEED.filter((post) => PUBLISHED_BLOG_SLUGS.has(post.slug))
}

export function postBySlug(slug: string): BlogPostSeed | null {
  return publishedPosts().find((post) => post.slug === slug) ?? null
}

export function postSlugs(): string[] {
  return publishedPosts().map((post) => post.slug)
}

export function relatedPosts(slug: string, count = 3): BlogPostSeed[] {
  const current = postBySlug(slug)
  if (!current) return []
  const posts = publishedPosts()
  return posts
    .filter((post) => post.slug !== slug && post.category === current.category)
    .concat(posts.filter((post) => post.slug !== slug && post.category !== current.category))
    .slice(0, count)
}
