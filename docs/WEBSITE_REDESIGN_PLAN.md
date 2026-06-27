# Omnix Website — UX, Messaging & Conversion Redesign Plan

_Plan only. No code changes until this direction is approved._

This plan is grounded in a full read of the live website: ~23 public pages,
the landing component set (`components/landing/*`), the shared `variant-landing`,
the navigation (`site-header.tsx`), and the committed design system
(`globals.css`). It preserves the existing brand, palette, typography, spacing,
components, theming and motion exactly — and uses the installed design skills
(`frontend-design`, `emil-design-eng`, `hallmark`, `ui-ux-pro-max`,
`anti-slop-writing`).

---

## 0. The one strategic decision I need from you first

There is a real tension between the brief and the live product, and it changes
the whole redesign. I won't guess on it.

**The live site is deliberately positioned as a Kenyan SME owner-operator tool.**
- Headline: _"POS with M-Pesa. Built for Kenya."_
- `globals.css` brief: _audience "Kenyan SME owner-operators, 28–55, buying once"_, _"locally fluent"_, _"If we can't explain it to your grandmother, we built it wrong."_
- About page, founder note, pricing (KES 30,000 once), eTIMS/M-Pesa pages all reinforce this.

**Your brief asks for enterprise-grade, multi-industry ERP positioning** —
_"Run your entire business from one intelligent platform"_, _"the modern ERP
built for businesses that expect more"_, full Products/Industries/Solutions
mega-nav, per-module + per-industry pages, roadmap, careers, etc.

These are two different companies. My recommendation, and the basis of this
plan unless you say otherwise:

> **Elevate, don't replace.** Keep the warm-luxe editorial identity and the
> Kenyan-fluency that builds local trust, but raise the _perceived product
> ceiling_ to "intelligent business platform" — lead with the platform story,
> let M-Pesa/eTIMS/offline become the proof points that make it credible
> _here_, and add the enterprise trust architecture (security, reliability,
> migration, roadmap) the brief asks for.

This keeps the thing that's actually converting (local relevance, "own it,
pay once") while delivering the enterprise gravity you want. A literal
"global enterprise ERP" repositioning would discard the site's strongest
trust signals and contradict the product (single-device, KES pricing, SME
target). **Confirm this "elevate, don't replace" framing, or tell me you want
a harder enterprise pivot, before I build.**

Two more scope realities to align on:
- The brief lists ~40+ new/!redesigned pages (11 module pages, 8 industry
  pages, AI, M-Pesa, migration, roadmap, careers, full docs IA…). That's a
  multi-week build. I've **phased it by conversion impact** (§6) so the
  highest-ROI work ships first and you can stop at any phase.
- Some brief items don't match the product and I'd advise against:
  **CRM** and **Restaurant-separate-from-Hospitality** modules don't exist
  (hospitality already covers restaurants); **Supermarkets/Wholesalers** are
  retail sub-cases not separate modules; **API docs** — there's no public API.
  I'll fold these into honest pages rather than invent capability (inventing
  features is the fastest way to destroy enterprise trust).

---

## 1. Full page audit

Legend: 🟢 strong · 🟡 weak/partial · 🔴 missing or hurting conversion

| Page | Purpose today | Verdict | Core problem |
|---|---|---|---|
| **Home** `/` | Sell the product | 🟡 | Editorial & beautiful, but reads as "a nice POS" not "a platform you grow with". Hero leads with category-narrow "POS with M-Pesa". No "why switch", no security/reliability, no real product screenshots (PosPreview is a hand-built mock; real shot only if admin uploads). Founder note is high up — charming but premature before value is established. |
| **Modules** `/modules` | List 4 trades | 🟡 | Placeholder screenshots (diagonal-hatch boxes), no per-module depth, no "problems solved", no FAQ. Just a directory. |
| **Module pages** `/dawa /retail /hospitality /hardware /pro` | Per-trade landing | 🟡 | All share one `variant-landing` template — good for consistency, but generic; no workflow, screenshots, industry-specific proof, or module FAQ. |
| **AI** `/ai` | Sell AI | 🟡 | Predates the v0.15 AI leap. Positions AI as assistant/chat, not the new "ask-your-data + confirmed actions + insights" reality. Hugely under-sells the strongest current differentiator. |
| **M-Pesa** `/mpesa` | Explain payments | 🟢/🟡 | Solid; needs the payment-flow diagram + reconciliation visual + FAQ the brief wants. |
| **eTIMS** `/etims` | Explain KRA | 🟢 | Strong, detailed. Keep, light polish. |
| **SHA** `/sha`, **Payroll pack** `/payroll-pack` | Niche compliance | 🟢 | Good long-form. Keep. |
| **Pricing** `/pricing` | Convert | 🟡 | Functional but doesn't sell _value_ before price, no edition comparison clarity, no "what's included vs optional", thin FAQ, no risk-reversal (trial/guarantee) framing at the decision point. |
| **Downloads** `/downloads` | Get the app | 🟡 | Exists; needs system requirements, version history, checksums, update-policy, install guide per the brief. |
| **Changelog** `/changelog` | Show momentum | 🟢 | Good (we just improved it). Add categorised entries (features/fixes/security) framing. |
| **Docs** `/docs` + `/docs/[slug]` | Help | 🟡 | Entry point is thin; no IA grouping (Getting started / Install / Migration / Modules / AI / Troubleshooting). |
| **Support** `/support` | Help + trust | 🟡 | Light. No KB structure, response-time expectations, onboarding, remote-support, license management. |
| **Contact** `/contact` | Reach us | 🟡 | One generic form. No routing (sales/support/partnerships), no hours, no expected response time. |
| **About** `/about` | Trust in company | 🟢 | Genuinely good editorial. Keep, extend with vision/mission + team. |
| **Blog** `/blog` | SEO/authority | 🟡 | Exists, sparse. Lower priority. |
| **Legal** `/privacy /terms /refund-policy` | Compliance | 🟢 | Present. Audit for consistency + add cookies/data-protection note. |
| **Roadmap** | — | 🔴 | Missing. Brief wants it; strong future-proofing trust signal. |
| **Migration** | — | 🔴 | Missing. Huge buying-hesitation reducer ("can I move my data?"). |
| **Industries** | — | 🔴 | Missing. Brief wants them; partially redundant with module pages — I'll do a lean version (§5). |
| **Security / Reliability** | — | 🔴 | Missing as a destination. Top enterprise trust gap. |
| **Careers** | — | 🔴 | Missing. Lowest priority; include a simple honest page. |

### Cross-cutting problems
1. **Positioning ceiling too low** — "POS" framing caps perceived value; the product is already an ERP + AI platform.
2. **Product isn't the hero** — placeholder mocks instead of real screenshots; the brief is right that the app should sell itself.
3. **Trust architecture is thin** — no security, reliability, migration, or "why switch" anywhere. Buyers evaluating 5–10-year software need these.
4. **AI is stale** — the single biggest new differentiator (v0.15) is barely represented.
5. **Navigation is shallow** — 6 flat items; doesn't signal a mature platform or expose Products/AI/Industries/Resources.
6. **CTAs are mostly single-path** ("Start free trial") with some dead-ends (About, legal). Every page should route forward.

---

## 2. Information architecture & navigation (redesign)

Move from 6 flat items to a structured mega-nav that signals platform maturity
**without** inventing capability. Built with the existing header component
(dropdown pattern already exists for "Trades").

```
Products ▾        Industries ▾       AI        Pricing   Resources ▾        [Sign in] [Start free trial]
─────────         ──────────         ──        ───────   ──────────
By trade:         Pharmacies         (single   (single   Downloads
 Dawa (Pharmacy)  Retail & dukas      premium   page)    Documentation
 Retail           Restaurants &                          Migration
 Hospitality        bars                                 Roadmap
 Hardware         Hardware stores                        Changelog
Omnix Pro         Multi-branch                           Support
By capability:                                           Security & reliability
 POS · Inventory                                         About
 Accounting ·                                            Contact
 Purchasing ·
 Reports · AI
 M-Pesa · eTIMS
```

Rationale: **Products ▾** answers "what is it / does it do my job?";
**Industries ▾** answers "is it for a business like mine?"; **AI** and
**Pricing** are direct-intent so they stay top-level; **Resources ▾** holds the
trust + evaluation + post-purchase content. Persistent primary CTA stays
"Start free trial" (no card, 7 days — the strongest low-friction entry).

---

## 3. Homepage redesign — section by section (the core deliverable)

Reordered around the **buyer journey**: Attention → Comprehension → Belief →
Differentiation → Proof → Risk-reversal → Action. Every section answers one
buying question and uses only existing design tokens/utilities.

| # | Section | Buyer question it answers | Conversion job | Status |
|---|---|---|---|---|
| 1 | **Hero — platform thesis** | "What is Omnix & why care?" | Hook + primary CTA | **Rewrite** |
| 2 | **Trust strip** (offline · M-Pesa · eTIMS · own-your-data · auto-update) | "Is this credible/for here?" | Instant credibility, no checklist feel | **New** (woven, not a logo wall) |
| 3 | **"Run the whole operation" — unified platform** | "What does it replace?" | Comprehension: ERP+POS+AI in one | **New** (replaces feature-listing) |
| 4 | **The product, shown** — real screenshots (POS, dashboard, AI workspace, inventory) | "Is it actually good?" | Product sells itself | **Rewrite** (needs real shots) |
| 5 | **AI as a business employee** | "Will it save me real work?" | Differentiation: ask-your-data, confirmed actions, insights | **Rewrite** (sync to v0.15) |
| 6 | **Built for your trade** — 4 modules, real shots + outcome copy | "Does it fit my business?" | Self-select into a module page | **Rewrite** (`modules-rows`) |
| 7 | **Why businesses switch to Omnix** | "Why change from what I have?" | Overcome status-quo bias | **New** |
| 8 | **Reliability & data safety** (offline-first, auto-backup, auto-update, own your data) | "Can I trust it with my livelihood?" | Reduce risk fear | **New** |
| 9 | **M-Pesa + eTIMS, done right** | "Will payments & tax just work?" | Local proof points | **Merge** existing receipt-proof + compliance |
| 10 | **Owners in their words** — quotes/stories | "Do people like me trust it?" | Social proof | **Keep** `three-quotes` (upgrade when real stories exist) |
| 11 | **Migration & onboarding** — "bring your data in a day" | "How hard is switching?" | Remove the biggest practical blocker | **New** (links to Migration page) |
| 12 | **One price, own it forever** | "What's the catch / cost?" | Value-before-price, risk reversal | **Keep+strengthen** `one-price` |
| 13 | **FAQ** | "My last objections" | Final doubt removal | **Keep+expand** |
| 14 | **Closing CTA** | "OK, how do I start?" | Convert: trial / download / talk to us | **Keep+strengthen** (3 clear paths) |

**Demoted/removed from current homepage:** Founder note moves to About (charming
but premature at position 2); PDF-pack + "studio's hand" + "recent work"
placeholders consolidated into the trust/proof sections above rather than
standing as separate placeholder-heavy bands.

### Hero rewrite (the most important change)
- **Headline direction** (will refine 3–5 candidates, none copied from the brief examples):
  - _"The business platform you grow with — not out of."_
  - _"One platform to run the whole business. Even offline."_
  - _"Everything the business runs on. One app you own."_
  The chosen line leads with **platform + ownership + outcome**, keeps the
  italic-emphasis word the design system mandates.
- **Sub-copy:** outcome-led — _sell, stock, bank, pay staff, file tax, and ask
  your data — one Windows app that runs offline, takes M-Pesa, and is yours to
  own._ Differentiators implied, not listed.
- **Above-the-fold:** single primary CTA (Start free trial) + quiet secondary
  ("See it in action" → product section), price caption, real product shot in
  the existing BrowserFrame (not the placeholder mock).
- Answers all four required questions (what / different / trust / why buy) in
  the first screen.

---

## 4. Branded SVG illustration system (preserve identity)

Build a small, cohesive set of **terracotta-line illustrations** (single accent
`#C77B3F` on espresso, hairline strokes — matching the banned-generic-icons
rule in the brief) for the capabilities that deserve emphasis. Not flat emoji
icons; not stock. One visual language:

AI assistant · M-Pesa · Offline operation · Auto-update · Multi-device sync ·
Inventory · Reporting/Analytics · Security · eTIMS · Purchasing · Accounting ·
plus the 4 trade marks (Pharmacy/Retail/Hospitality/Hardware).

Delivered as a reusable `components/marketing/illustrations/*` set so module +
industry + feature pages share them. Validated against `ai-slop-check` patterns.

---

## 5. New & rebuilt pages (phased)

- **AI page** (rebuild): Business Assistant, Ask-your-data, AI imports &
  spreadsheet harmonisation, inventory/financial/customer/supplier intelligence,
  confirmed AI actions, BYO-key + privacy + offline-vs-online, AI roadmap.
- **Module pages** (rebuild on a richer shared template): Overview · problems
  solved · workflow · screenshots · benefits · key features · FAQ · related
  modules · CTA. Covers Dawa, Retail, Hospitality, Hardware, + capability pages
  (Inventory, Accounting, Purchasing, Reports, POS) at lighter depth.
- **Industries** (lean): Pharmacies, Retail/dukas, Restaurants & bars, Hardware,
  Multi-branch — each = problem framing + which module + proof + CTA. (Folds
  supermarket/wholesaler into retail to stay honest.)
- **Migration** (new): process, import inventory, AI spreadsheet harmonisation,
  validation, scenarios, checklist, onboarding.
- **Security & reliability** (new): offline-first architecture, SQLCipher
  encryption, auto-backup + restore, own-your-data, RSA licensing, update
  signing, LAN sync — the enterprise trust page.
- **Roadmap** (new): shipped / in progress / exploring — honest, no dates.
- **Downloads** (upgrade): OS, requirements, version history, checksums, update
  policy, install guide.
- **Docs / Support / Contact** (upgrade): real IA grouping; support routing +
  response expectations; contact by intent (sales/support/partnerships).
- **About** (extend): keep the letter, add vision/mission + team + "why we exist".
- **Careers / Legal** (light): honest careers page; legal consistency pass +
  cookies/data-protection.
- **SEO pass:** titles, descriptions, H1 hierarchy, internal linking, JSON-LD
  (SoftwareApplication/Product/FAQ/Breadcrumb), per-page canonical + OG.

---

## 6. Phased delivery (highest conversion ROI first)

| Phase | Scope | Why first |
|---|---|---|
| **A — Foundation & homepage** | Nav IA + mega-nav, hero rewrite, homepage section re-order, trust strip, illustration system kickoff, real screenshots wired | The homepage + nav drive the most traffic and first impressions; biggest conversion lever |
| **B — AI + Pricing + Product depth** | Rebuilt AI page (v0.15 reality), pricing value+comparison+risk-reversal, real product-shot section | The top differentiator + the decision page |
| **C — Trust & switching** | Security/reliability page, Migration page, "why switch" + onboarding sections, module-page template rebuild | Removes the biggest buying hesitations for 5–10-yr buyers |
| **D — Breadth & IA** | Industry pages, capability pages, Downloads/Docs/Support/Contact upgrades, Roadmap, About extend, SEO + JSON-LD pass, Careers/Legal | Completes the "mature software company" ecosystem |

Each phase is independently shippable, verified (website `tsc` + `pnpm build`),
and committed. After each, I'll give the per-section rationale the brief asks
for (why it exists, position, buyer concern, conversion goal).

---

## 7. Guardrails held throughout
- **No new design language.** Only existing tokens, utilities, components,
  fonts, motion. Every change passes the `globals.css` anti-pattern list +
  `ai-slop-check`.
- **No invented capability.** Trust is destroyed by claiming features the app
  doesn't have. Where the brief lists something that doesn't exist (CRM, public
  API, separate Restaurant module), I represent the real product honestly.
- **Real product > mocks.** Use actual screenshots via the existing
  `/admin/media` slot system + BrowserFrame; where a real shot doesn't exist
  yet I'll flag it rather than ship a misleading mock.
- **Every page routes forward** to trial / download / demo / contact — no dead
  ends.
- **Verify each phase:** website `tsc --noEmit` + `pnpm build` green before commit.
```
