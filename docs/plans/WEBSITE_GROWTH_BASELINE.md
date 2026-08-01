# Omnix Website Growth Baseline

**Captured:** 19 July 2026  
**Scope:** Pre-redesign website  
**Route inventory:** `docs/plans/WEBSITE_ROUTE_INVENTORY.md`  
**Visual archive:** `docs/baselines/website-before/`

## 1. Baseline purpose

This record fixes the current website state before the Working Counter redesign. It prevents subjective “looks better” approval and gives the release measurable before/after criteria for conversion clarity, discoverability, accessibility, rendering, and truthful claims.

## 2. Visual baseline

The opt-in Playwright capture in `website/tests/e2e/visual-baseline.e2e.spec.ts` archives:

- Homepage at 320, 375, 414, 768, 1024, and 1440px.
- Pharmacy, pricing, login, and checkout-success at 375 and 1440px.
- Light OS preference with the site’s actual first-visit theme behavior.
- Full-page output after traversing the document to trigger viewport reveals.

Fourteen screenshots were generated successfully.

### Observed visual issues

1. **Dark remains the effective default.** `globals.css` is light-first, but `ThemeProvider` uses `defaultTheme="dark"`; even a light browser preference captures the dark website on first visit.
2. **Hero readability is weak.** The large serif headline and lede are low-contrast against the dark surface, especially on mobile.
3. **Reveal-dependent blank space.** Full-page and rapid-scroll capture can leave large product/pricing regions visually blank. Important commercial content must not depend on JS viewport animation to become readable.
4. **Tablet overflow.** The homepage exceeded the 768px viewport by 6px during capture.
5. **Generic product imagery.** The hero screenshot visibly belongs to a different product (“Incircle”), weakening trust and product comprehension.
6. **Product mismatch.** Homepage copy says four trades while navigation and page data expose five products plus legacy Pro references.
7. **Template repetition.** Product pages use repeated feature-card grids and the same hierarchy regardless of industry.
8. **CTA hierarchy is inconsistent.** Homepage promotes trial; product pages compete between Buy and Trial; contact mentions demo; WhatsApp floats independently.
9. **Button geometry is mixed.** Pills, medium rectangles, text links, and large outlined cards compete without a shared action hierarchy.
10. **Auth is visually disconnected.** Login is sparse, dark, and operationally detached from the warmer marketing language.
11. **Unverified success UI.** The checkout-success screenshot presents payment/licence completion from an arbitrary query reference without server confirmation.

### Browser/runtime warnings recorded

- Above-fold hero product image is detected as LCP but is not eagerly loaded.
- Next.js reports the `middleware` convention as deprecated in favor of `proxy`.
- Better Auth reports missing Google credentials in the local baseline environment.
- A development run emitted “Failed to find Server Action x”; this must be reproduced and isolated before release.

## 3. Lighthouse baseline

One directional run per form factor was collected from `https://omnix.co.ke/ke` using Lighthouse CI 0.15.1. Scores are archived in `lighthouse-summary.json`.

| Metric | Desktop | Mobile | Release direction |
| --- | ---: | ---: | --- |
| Performance | 76 | 53 | ≥90 primary acquisition routes |
| Accessibility | 94 | 94 | 100 automated score plus manual keyboard checks |
| Best practices | 100 | 100 | Preserve 100 |
| SEO | 92 | 92 | 100 after canonical/schema/sitemap fixes |
| FCP | 0.9s | 1.2s | Preserve or improve |
| LCP | 2.4s | 6.3s | <2.5s at p75 target |
| TBT | 170ms | 1,080ms | <200ms directional lab target |
| CLS | 0.008 | 0 | Preserve <0.1 |
| Speed Index | 2.8s | 3.7s | Improve |

The mobile deficit is the critical performance baseline: LCP and blocking time indicate that imagery, hydration, motion, and client-side marketing code need focused reduction.

## 4. Conversion baseline

### Current primary paths

| Surface | Current action | Destination/problem |
| --- | --- | --- |
| Header | Start free trial | `/signup`; account creation precedes qualification |
| Homepage hero | Start free trial | `/signup`; no demo option in primary hierarchy |
| Homepage sticky CTA | Buy/start path | Appears after scroll and competes with WhatsApp |
| Product hero | Buy product | `/buy?variant=…` |
| Product hero secondary | Start 30-day trial | `/signup?variant=…` |
| Closing CTA | Start free trial | Global fallback |
| Contact | General enquiry / demo copy | Demo is not a dedicated funnel |
| WhatsApp widget | Open chat panel then `wa.me` | Hard-coded number in component rather than site settings |
| Pricing | Trial/purchase by tier | Pro/four-product inconsistency |
| Checkout | Paystack | Purpose and trial-policy mismatches |

### Missing conversion infrastructure

- No dedicated demo route or qualification form.
- No consistent industry/location attribution.
- No demo acknowledgement email flow.
- No first-party conversion event taxonomy.
- No verified checkout-success state machine.
- No primary-CTA consistency across marketing pages.
- No visible customer-proof system with consent/verification controls.

### Approved conversion hierarchy

1. **Primary:** Book a demo.
2. **Secondary:** WhatsApp.
3. **Down-funnel:** Trial, download, and purchase after product qualification.

## 5. SEO baseline

### Strengths

- Locale-aware root titles/descriptions exist.
- Product metadata exists for the major variants.
- Organization, SoftwareApplication, FAQ, Breadcrumb, and Article helpers exist.
- Robots and sitemap endpoints exist.
- Public pages are server-rendered.

### Critical gaps

1. Most child routes inherit homepage canonical, hreflang, OG, and Twitter values.
2. Internal links are not locale-aware and often add redirects.
3. Header active-state matching fails on localized paths.
4. Sitemap uses incorrect/partial locale treatment, unstable `lastModified`, and incomplete route coverage.
5. `/pharmacy` and `/dawa` split one search intent.
6. Kenya-only integration pages are duplicated under non-Kenya locales.
7. `/blog` cards point to slugs that do not exist.
8. Generated TODO documentation is crawlable and indexed.
9. Software schema categorizes products as Enterprise Resource Planning.
10. No location route architecture exists.
11. No national buyer-guide cluster exists.
12. No `x-default`/language strategy consistently spans all route types.

## 6. Positioning/content baseline

### Current message

- Generic “platform” framing in the homepage H1.
- Heavy emphasis on AI before the four commercial products.
- Feature-first product pages.
- Mixed “one platform,” “four trades,” five active trade routes, and legacy Pro language.
- Trial and direct purchase emphasized ahead of consultation/installation.

### Approved message

- Business software for pharmacies, retailers, hospitality businesses, and hardware stores.
- Concrete outcomes: keep selling offline, control stock, take M-Pesa, issue eTIMS receipts, own the software.
- Four distinct products with industry-native workflows.
- Professional setup, migration, local context, and data ownership.
- No generic ERP positioning in acquisition copy.

## 7. Claims baseline and evidence status

No claim below should be strengthened or repeated until its implementation and legal/commercial wording are verified.

| Claim family | Current examples | Baseline status | Required evidence/action |
| --- | --- | --- | --- |
| Pricing | “No annual fees” beside yearly maintenance/compliance pricing | Contradictory | Align pricing config, legal terms, checkout, and copy |
| Trial | 14-day creation vs 30-day UI/API claims | Contradictory | One policy constant and tested issuance flow |
| Product count | Four trades, five trade pages, Pro purchase references | Contradictory | Four-product public registry; legacy compatibility rules |
| eTIMS | “Every sale signed and submitted automatically” | Needs verification | Map to actual online/offline queue and failure behavior |
| Pharmacy/PPB | “PPB-compliant,” PPB-format controlled register | Needs legal/product verification | Verify report fields and use support-oriented wording |
| SHA/NHIF | Membership verification, claims submission, reconciliation, “under 5 seconds” | High-risk/unverified | Confirm live integrations and remove timing claim without telemetry |
| Private insurance | AAR/Jubilee/CIC and “any payer with API” | Needs verification | Name only implemented/tested providers |
| Offline sync | Branches “sync in real time over LAN” | Needs verification | Describe actual topology, conflict, and offline limits |
| Hardware | NCA verification, bonded warehouse, automatic contractor workflows | Needs verification | Map each statement to shipped implementation |
| Hospitality | F&B/tourism levy and liquor compliance | Needs verification | Confirm current Kenyan rules and actual calculations |
| Backups | SQLite/database described as encrypted | Incorrect/ambiguous | State OS-level DB protection and encrypted backup behavior accurately |
| Security | AES-256/RSA/Argon2 claims | Partially evidenced | Distinguish website settings, backup, licence signing, and password hashing |
| Performance | 50ms lookup and similar timings | Unverified marketing metric | Benchmark or remove |
| Setup/support | Response and installation timing claims | Commercial commitment needed | Define SLA before publishing |
| Testimonials | Proposed names, quotes, savings, locations | Not available | Never fabricate; require customer consent and verification |

## 8. Accessibility and interaction baseline

- Automated Lighthouse accessibility: 94 desktop/mobile.
- Theme toggle uses a stable pre-hydration placeholder.
- Several menus lack complete keyboard/focus behavior.
- Mobile dashboard drawer lacks a focus trap.
- Notification control has no outcome.
- Empty states and form errors are inconsistent.
- Large portions of the marketing page depend on motion visibility.
- Current button and text contrast requires route-level review.
- Route-shaped loading and error states are missing from most groups.

## 9. Test baseline

- Route inventory: 3/3 passing.
- Existing public Playwright suite initially passed 9/10; the only failure was a stale H1-specific M-Pesa assertion.
- The assertion was converted into a durable positioning contract: H1 must not position Omnix as ERP, the page must explain M-Pesa, and the document title must identify Omnix.
- Visual baseline capture: 14/14 passing after making pre-existing overflow diagnostic rather than fatal.
- Website TypeScript: passing at the end of Task 1.

## 10. Baseline acceptance

The redesign will be considered an improvement only if it:

1. Preserves every intentional route and API contract in the machine inventory.
2. Establishes light as the real first-visit default.
3. Removes commercial content hidden behind reveal animation.
4. Eliminates horizontal overflow at all required widths.
5. Moves mobile Lighthouse performance materially toward 90 and LCP below 2.5s.
6. Raises automated accessibility and SEO to 100 without reducing usability.
7. Provides one consistent Book-a-demo conversion path with WhatsApp secondary.
8. Publishes only verified claims and customer proof.
9. Resolves canonical, locale, sitemap, duplicate, and schema conflicts.
10. Accounts for marketing, auth, checkout, dashboard, and admin—not only the homepage.
