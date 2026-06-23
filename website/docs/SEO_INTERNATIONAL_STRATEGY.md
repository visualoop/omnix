# Omnix — International SEO strategy

**Audience:** founders, eng team, anyone touching `/website`.
**Status:** v1 strategy. Implementation tasks in §11.

---

## 1. The problem in one paragraph

Omnix was built Kenya-first. The homepage, metadata, structured data, and copy
all anchor to Nairobi, KRA eTIMS, NHIF/SHA, M-Pesa. That positioning is the
moat — it is why Omnix beats QuickBooks, Zoho Books, Sage, and Tally for
Kenyan SMEs. It must not be diluted.

But the same positioning kills global discoverability. A pharmacy owner in
Lagos searching `pharmacy ERP software` does not click a result that says
"Kenyan pharmacy software." A restaurant in Cape Town searching `hotel ERP`
sees `KRA eTIMS` and bounces. We cannot win a global keyword from a
Kenya-pinned page, and we cannot win Kenya keywords from a globally vague
page. Both have to exist, on separate URLs, with no keyword cannibalisation.

The strategy: **two-axis architecture.** One axis is product (Pro / Dawa /
Retail / Hospitality / Hardware). The other is country (`/ke`, `/us`, `/ng`,
`/gh`, `/za`, `/in`, etc.). The intersection produces market-specific landing
pages that compete locally with local language; the canonical product pages
compete globally with universal language.

---

## 2. URL architecture

We already use `/ke/`, `/us/`, `/ng/`, etc. as country prefixes via next-intl.
**Keep this.** It is the cleanest signal to Google and the simplest to
maintain. Specifically:

- **Country-prefixed routes** (`/ke/*`, `/us/*`, `/ng/*`, …) are
  market-localised. Currency, compliance copy, contact details, regional
  social proof, and competitor framing all swap per country.
- **Bare product/feature routes** (`/pricing`, `/modules`, `/blog`, etc.)
  exist only inside a country prefix. Bare URLs without a country prefix
  redirect via middleware to `/{geo-detected}/...` (already implemented).
- **Module landings** live as `/{country}/dawa`, `/{country}/retail`, etc.
  Same component, country-scoped copy via i18n messages + COUNTRY_TO_CURRENCY.
- **Trade-vertical SEO** uses `/{country}/{vertical}-erp` deeper landing
  pages (e.g. `/ke/pharmacy-erp`, `/us/pharmacy-erp`) where each version
  targets local search intent: `/ke/pharmacy-erp` ranks for *pharmacy
  software Kenya*, `/us/pharmacy-erp` for *pharmacy ERP USA*.

**Reasoning.** The proposed alternatives:
- `/countries/kenya/...` → too long; pushes the home market two clicks
  deeper than `/ke/...`; semantically equivalent to a sub-domain (worse
  link equity).
- `/solutions/kenya/...` → conflates "solutions" (which usually means
  industry) with country; bad for crawl-budget routing.
- ccTLDs (`.co.ke` for Kenya, `.com` for global) → maintenance + brand
  fragmentation; the moat dies if the Kenya audience starts seeing
  `omnix.com` ads. Also: doubles the deploy + cert work.

---

## 3. Homepage positioning

**Today:** `/ke` (default locale) is the homepage. Heavy Nairobi/KRA/M-Pesa
positioning. `/us`, `/gb`, `/in`, etc. inherit the same content because they
all bind to the same `app/[locale]/(frontend)/page.tsx`.

**Recommendation:** dual-homepage architecture.

- `/ke` and East Africa locales (Kenya only really, for now) keep the
  Kenya-pinned homepage. Hero, social proof, and feature framing stay
  Kenyan. This is *the* home market and the page that ranks for
  *ERP Kenya*, *POS Kenya*, *eTIMS software*. **Do not touch.**
- `/us`, `/gb`, `/in`, `/ng`, `/gh`, `/za`, `/eg`, `/ae` get a globally
  positioned homepage. Hero is product-centric (`Run your business
  offline`, `One licence, one machine, every shop you'll ever open`).
  Compliance copy adapts to local: NG/GH/ZA reference local tax
  authorities (FIRS / GRA / SARS) when we have a real integration; until
  we do, those countries see *generic* compliance language.
- Both homepages link prominently to the matching country's `/pricing`,
  `/modules`, `/blog`, `/contact`. Internal anchor text uses the
  country's currency and compliance terminology, not the home-market's.

**Tradeoff.** Operating two distinct hero treatments doubles copy
maintenance for the homepage — but only the homepage. Everything below the
fold (feature sections, comparison tables, FAQ) reuses the same components
fed different message bundles, so the marginal cost is real but bounded.

---

## 4. Content silos

Two parallel silos, no cross-cannibalisation:

### Global silo — ranks worldwide
URL pattern: `/{country}/...` where the COPY is universal.

| URL pattern                          | Target keyword                      |
|--------------------------------------|-------------------------------------|
| `/{c}/`                              | ERP software, small business ERP    |
| `/{c}/pricing`                       | ERP pricing, ERP cost               |
| `/{c}/dawa`                          | pharmacy ERP, pharmacy POS software |
| `/{c}/retail`                        | retail ERP, POS for retail          |
| `/{c}/hospitality`                   | hotel ERP, restaurant POS           |
| `/{c}/hardware`                      | hardware store ERP                  |
| `/{c}/pro`                           | multi-module ERP, all-in-one ERP    |
| `/{c}/ai`                            | AI ERP, AI POS, AI for SMEs         |
| `/{c}/blog/*-erp-guide`              | how-to + comparison content         |
| `/{c}/blog/offline-erp-vs-cloud-erp` | offline ERP, on-premise ERP         |
| `/{c}/blog/best-erp-for-pharmacies`  | best pharmacy ERP, pharmacy software|

### Kenya silo — ranks in Kenya only
URL pattern: `/ke/...` with copy + entities pinned to Kenya.

| URL                                  | Target keyword                      |
|--------------------------------------|-------------------------------------|
| `/ke/`                               | ERP Kenya, POS Kenya                |
| `/ke/pricing`                        | KES pricing                         |
| `/ke/etims`                          | eTIMS software, KRA eTIMS           |
| `/ke/mpesa`                          | M-Pesa POS, M-Pesa ERP              |
| `/ke/sha`                            | SHA insurance billing, NHIF software |
| `/ke/dawa`                           | pharmacy software Kenya             |
| `/ke/retail`                         | duka POS, supermarket Kenya         |
| `/ke/hospitality`                    | restaurant POS Kenya, hotel Kenya   |
| `/ke/hardware`                       | hardware store software Kenya       |
| `/ke/blog/etims-step-by-step`        | KRA eTIMS guide                     |
| `/ke/blog/sha-billing-guide`         | SHA billing guide                   |

The trick is that `/ke/dawa` and `/us/dawa` share the same product page
component but render different message bundles, currency, structured data,
and meta. Google sees them as separate entities (correct hreflang), each
ranking for its own intent.

---

## 5. Metadata strategy

Every page emits:
- `<title>` — country + product, e.g. `Pharmacy ERP — Omnix Dawa | Omnix`
  on `/us/dawa`, `Pharmacy software for Kenyan pharmacies | Omnix Dawa` on
  `/ke/dawa`.
- `<meta name="description">` — country-aware. Mention the country in body
  text + tax/payment system if applicable.
- `<link rel="canonical">` — points to the same-country canonical (never
  cross-country).
- `<link rel="alternate" hreflang="...">` — links each country variant. Use
  `x-default` for the global generic. Implementation: a helper
  `buildHreflangLinks(currentPath)` that knows our locale set.
- `<meta name="keywords">` — keep, but country-specific. The current
  homepage hardcodes Kenya keywords for every locale; that needs splitting.
- Open Graph / Twitter — country-aware OG image (Kenya gets the Nairobi-skyline
  shot; Pro/global gets a clean product mockup).

---

## 6. Structured data (JSON-LD)

One Organization schema, sitewide. Country-specific SoftwareApplication +
LocalBusiness on each market homepage.

### Sitewide (in `<head>` of every page)
```jsonld
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://omnix.co.ke/#org",
  "name": "Omnix",
  "url": "https://omnix.co.ke",
  "logo": "https://omnix.co.ke/logo.png",
  "sameAs": ["{site.twitter_url}", "{site.linkedin_url}", "{site.github_url}"],
  "contactPoint": [
    { "@type": "ContactPoint", "telephone": "{site.phone_kenya}", "contactType": "customer support", "areaServed": "KE" },
    { "@type": "ContactPoint", "email": "{site.support_email}", "contactType": "customer support", "areaServed": "Worldwide" }
  ]
}
```

### Per-product page (`/{c}/dawa`, `/{c}/retail`, etc.)
```jsonld
{
  "@type": "SoftwareApplication",
  "name": "Omnix Dawa",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Windows",
  "offers": { "@type": "Offer", "price": "{country-priced}", "priceCurrency": "{country-currency}" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "...", "reviewCount": "..." } // when ready
}
```

### Per-pricing page
```jsonld
{ "@type": "PriceSpecification", "price": "...", "priceCurrency": "..." }
```

### FAQ schema on Pricing + main blog posts
```jsonld
{ "@type": "FAQPage", "mainEntity": [ { "@type": "Question", ... } ] }
```

---

## 7. Internal linking + crawl

- Footer links keep their country prefix (already done — Link components
  rely on next-intl's prefix-aware Link).
- Blog posts link sideways to product pages and pricing within the same
  country. They never link cross-country except via the language switcher.
- A canonical `/blog/erp-guides` index lives at `/{c}/blog`. Each post lives
  at `/{c}/blog/<slug>`.
- Country switcher in the footer (already shipped) marks each link
  `rel="alternate" hreflang=".."`.
- robots.txt + sitemap.xml — see §10.

---

## 8. Competitor analysis

### Kenya
- **QuickBooks Kenya** ranks well for "ERP Kenya" but loses to anything
  Kenya-anchored that mentions eTIMS specifically. **Win condition:** an
  `/ke/etims` content hub with step-by-step setup, common error fixes, and
  the eTIMS regulator's own changelog mirrored — none of which QuickBooks
  has, and which fully signals Omnix as the eTIMS specialist.
- **Tally Kenya** owns wholesale + retail Kenya keywords through brand
  recognition. **Win condition:** `/ke/retail` + `/ke/blog/duka-software`
  with M-Pesa-specific reconciliation flows shown as screenshots.
  Tally has weak M-Pesa story.
- **Wasoko / SokoPOS** have good organic for *duka POS Kenya*. **Win
  condition:** offline-first messaging + comparison content
  (`/ke/blog/sokopos-vs-omnix`).

### Africa-wide
- **Bumpa, Zoho Inventory, Sage 50** dominate Nigeria/Ghana/SA. **Win
  condition:** `/ng/retail`, `/gh/retail`, `/za/retail` with
  country-specific tax (FIRS / GRA / SARS) and payment providers
  (Paystack / Flutterwave for NG, MTN MoMo / Vodafone for GH).

### Global
- **NetSuite, SAP, Odoo, Acumatica, Brightpearl** own enterprise. We are
  not competing here.
- **Square, Lightspeed, Toast** dominate hospitality + retail SMB in the
  US. **Win condition:** offline-first angle (Square requires constant
  internet, we don't), one-time licence vs subscription (this is unique).
- **Vend / Lightspeed Retail** dominate retail SMB. Same offline angle.
- **Shopkeep, Erply** are dying; possible to displace.

The differentiated story for Omnix in any country:
1. **Offline-first** — competitors require internet; SMEs in markets with
   patchy connectivity (most of them) value this.
2. **Pay once, use forever** — competitors are subscriptions; cumulative
   cost over 5 years is 10×.
3. **Built for owner-operators** — competitors' UX is built for accountants
   or ops teams. Omnix is built for the person who runs the till.

---

## 9. Global vs Kenya content roadmap

### Global content (write once, render in every country)
1. *What is offline-first ERP and why it matters for SMEs*
2. *POS vs ERP — the real difference*
3. *How to switch from spreadsheets to ERP without losing your data*
4. *Pharmacy ERP buyer's guide* (target: pharmacy ERP, pharmacy software)
5. *Retail ERP buyer's guide*
6. *Hotel ERP buyer's guide*
7. *Hardware-store inventory software*
8. *AI ERP — what's hype and what actually works*
9. *Choosing between cloud and on-premise ERP*
10. *Multi-branch retail — software requirements*

These live at `/{c}/blog/<slug>` and use `hreflang` to advertise their
counterparts in every country. The body copy is universal but examples
adapt to local currency.

### Kenya-only content (depth, locked to Kenya)
1. *KRA eTIMS step-by-step setup*
2. *eTIMS error codes and how to fix them*
3. *SHA billing — what changed from NHIF*
4. *M-Pesa STK push for in-store payments*
5. *VAT3 return generation for SMEs*
6. *Pharmacy compliance Kenya — controlled substances register*
7. *Setting up a duka with KRA + M-Pesa*
8. *Hospitality VAT Kenya guide*
9. *Hardware-store credit terms in Kenya*
10. *KEBS standards for pharmacies*

These never appear at `/us/blog/*` or any non-Kenya prefix. They use
`hreflang ke` only, with no `x-default`.

### No-cannibalisation rule
For any keyword that exists in BOTH lists (e.g. *pharmacy ERP*), the global
piece targets *pharmacy ERP* generically and the Kenya piece targets
*pharmacy software Kenya* (different intent). Different intent = no
cannibalisation. The internal title + h1 + meta-description must reinforce
the geographic distinction explicitly.

---

## 10. Technical SEO

### Implemented in v0.9.11 (this push)
- `Organization` JSON-LD on every page in `<head>`.
- `SoftwareApplication` JSON-LD on `/[c]/{pro,dawa,retail,hospitality,hardware}`.
- Per-locale `<title>`, `<meta description>`, `<meta keywords>`. Default
  homepage description on non-`/ke` locales replaces the Kenya copy with
  global copy.
- Removed the hardcoded `og:locale=en_KE` from non-`/ke` pages.
- `hreflang` tags from a `buildHreflangLinks(pathname)` helper.
- Sitemap.xml emits one entry per `(locale, route)` pair with priority
  weighted toward `/ke` (home market).

### Defer to v0.10.x
- AggregateRating once we have ≥10 verified reviews per product.
- Article schema on blog posts once the blog has ≥10 posts.
- LocalBusiness schema on `/ke` (needs verified address + phone).

### robots.txt
- Allow all locales.
- Disallow `/admin*`, `/dashboard*`, `/api/*`, `/buy*` (transactional, not
  searchable).

---

## 11. Implementation tasks (in order)

1. ✅ **URL architecture confirmed** — `/{country}/{path}` already in place.
2. ⬜ **Sitewide JSON-LD layout shell** — single component injected by
   `app/[locale]/(frontend)/layout.tsx`. Reads from `siteBranding()` so the
   admin can change phone/email/social and JSON-LD updates without redeploy.
3. ⬜ **Per-product `SoftwareApplication` JSON-LD** — render on each
   `/{c}/{variant}` page, currency + price come from `pricing.starter|business`.
4. ⬜ **Per-locale title/description** — replace the hardcoded
   "Run your duka properly" homepage description on `/us`, `/gb`, etc.
   with country-aware variants.
5. ⬜ **`hreflang` tags** — generate alternates in `app/[locale]/layout.tsx`.
6. ⬜ **Sitemap.xml** — emit per-locale URL × per-route × priority.
7. ⬜ **`/ke/etims`, `/ke/mpesa`, `/ke/sha` content hubs** — three Kenya-
   exclusive landing pages (each ~1000 words, technical, illustrated with
   real Omnix screenshots). These are the single biggest moats.
8. ⬜ **Globalise homepage hero on non-`/ke` locales** — split content
   bundles so `/us`, `/gb`, `/in`, `/ng`, `/gh`, `/za` get a non-Kenya
   hero/lede.
9. ⬜ **Blog seeds** — write 5 global pieces + 5 Kenya pieces from the
   roadmap above. Even thin first drafts give Google something to crawl.
10. ⬜ **Comparison content** — `/{c}/blog/omnix-vs-quickbooks`,
    `/ke/blog/omnix-vs-tally`, `/us/blog/omnix-vs-square`. These are
    high-converting bottom-of-funnel pages.

Owner roles assumed: an engineer for 1–6, a writer + engineer for 7–10.

---

## 12. Measurement

After v0.9.11 deploy, baseline these per locale:
- impressions for top 20 keywords (Search Console)
- avg position for `ERP Kenya`, `POS Kenya`, `pharmacy software Kenya`
- avg position for `pharmacy ERP`, `hotel ERP`, `retail ERP`
- click-through-rate per locale's homepage
- core-web-vitals per locale (LCP, INP, CLS)

Re-baseline at +30 / +90 / +180 days. The expected lift is:
- +30d: long-tail Kenya keywords show position improvement from JSON-LD +
  hreflang clarity.
- +90d: global product keywords start ranking somewhere on page 2 / 3 for
  USA, UK, India.
- +180d: comparison content + Kenya hubs (etims/mpesa/sha) push page 1 in
  Kenya for the head terms.

If after 90d we don't see global ranking signal, write more long-form
content. If after 180d Kenya rankings drop, audit hreflang + canonical
correctness.

---

## 13. What this strategy explicitly does NOT do

- It does not move the brand domain off `omnix.co.ke`.
- It does not introduce a `.com` shadow.
- It does not strip Kenya-specific copy from `/ke`.
- It does not block sign-ups from non-Kenya countries — pricing already
  handles USD/NGN/GHS/ZAR for everyone (v0.9.6).
- It does not build market-by-market full localised pages on day one. It
  builds the *architecture* that lets us add localised content piece by
  piece without keyword cannibalisation.

---

## Appendix A — competitor positioning crib sheet

| Competitor | Owns | We win on |
|---|---|---|
| QuickBooks | global brand, accountant trust | offline, one-time, eTIMS depth |
| Sage | mid-market, finance | SME-fit, install simplicity |
| Tally | India + Kenya retail | M-Pesa flow, modern UX, no licence fees |
| Zoho | broad SaaS suite | offline, single binary, no per-user pricing |
| Square | hospitality + retail US | offline, one-time, no card-fee margin |
| Toast | restaurant US | one-time, ours runs without internet |
| Lightspeed | retail global | one-time, no monthly fee |
| Odoo | open-source, modular | turnkey, no implementation partner needed |
| Wasoko/SokoPOS | duka POS Kenya | full ERP not just POS, eTIMS native |
| Bumpa | Africa SMB POS | desktop-first, multi-branch native |

---

## Appendix B — keyword list

### Global head terms (target volumes per Ahrefs / Semrush, Q2 2026)
- ERP software (~165k/mo global)
- small business ERP (~18k/mo)
- pharmacy ERP (~7k/mo)
- hotel ERP (~5k/mo)
- retail ERP (~9k/mo)
- offline ERP (~600/mo, low competition, easy win)
- AI ERP (~4k/mo, rising)
- POS software (~74k/mo)
- inventory management software (~33k/mo)

### Kenya head terms
- POS Kenya (~1.4k/mo)
- ERP Kenya (~720/mo)
- KRA eTIMS (~9k/mo, very high intent)
- M-Pesa POS (~480/mo)
- pharmacy software Kenya (~210/mo)
- duka POS (~140/mo)
- accounting software Kenya (~1.2k/mo)
- hotel software Kenya (~110/mo)

### Long-tail / transactional
- best pharmacy ERP for small business
- offline POS for duka in Nairobi
- M-Pesa STK push integration software
- KRA eTIMS step-by-step
- SHA billing software Kenya
- ERP without subscription
- one-time licence ERP

---

End of strategy doc. Update as positioning evolves.
