# Homepage Critique + Cut (v0.26.0)

## Diagnosis

The old homepage had **15 full-width sections**:
1. Hero · 2. Trust strip · 3. Unified Platform (8 capability cards) · 4. AI · 5. Modules Row (4 trades) · 6. Why Switch · 7. Reliability (4 pillars) · 8. Receipt Proof · 9. Recent Work · 10. Compliance · 11. Three Quotes (3 quotes) · 12. One Price · 13. FAQ · 14. Founder Note · 15. Closing CTA.

Card counts: ~30 discrete "trust me" units before the price.

Two problems:
1. **Everything looks the same.** Every section uses the eyebrow / big serif headline / lede / card-grid pattern. By section 6 the reader is trained to skim past headers.
2. **Emotional peak → purchase button gap.** The moment a buyer says "I love this" is right after the hero. The primary CTA next appears 14 scrolls away at the Closing section. That's a broken funnel.

## Cut — 15 sections → 7

Homepage now answers the three questions the owner actually has, in this order:

1. **Hero** — thesis + primary CTA + secondary "see it in action" scroll to AI section
2. **Trust strip** — offline · M-Pesa · eTIMS · data · updates
3. **AI section** — the real differentiator, "ask your data + act on it"
4. **Modules row** — which trade are you?
5. **One price** — value → price → risk reversal
6. **FAQ** — final objections
7. **Closing CTA** — convert

Sections cut from the homepage (still exist as components — they'll move to module pages or `/about` in follow-up releases):
- **Unified Platform** — redundant with Modules Row
- **Reliability** — belongs on module pages where technical trust matters
- **Receipt Proof** — belongs on Dawa
- **Recent Work** — needs 20+ named customers first
- **Compliance** — belongs on module pages
- **Why Switch** — belongs on module pages
- **Three Quotes** — needs 20+ named customers first
- **Founder Note** — moved to `/about` (didn't build the route yet, follow-up)

## Sticky mini-CTA — solves the 14-scroll gap

New component `sticky-buy-cta.tsx` renders a bottom-right cream card:

```
Ready when you are
KES 30,000 once   [Start free trial →]
```

- Appears after `window.scrollY > 700` (past the hero on any viewport).
- Hides when the ClosingCtaSection enters view (matched via `data-closing-cta` marker).
- Hidden below 640px — mobile hamburger + primary Start Trial button already serve the same need without eating screen real estate.
- Respects `prefers-reduced-motion`.
- Slides up on entry, slides down on exit (Framer Motion).

## Header responsiveness fix

Under the old breakpoints:
- < 640px (mobile): wordmark + hamburger only. Fine.
- **640–1024px (tablet, small laptop): wordmark + theme toggle + sign-in link + Start Trial button + hamburger — right cluster full, but nav hidden. Weird half-state.**
- ≥ 1024px: full desktop nav.

Now:
- < 640px (mobile): wordmark + hamburger. Same as before.
- 640–767px: wordmark + Start Trial button + hamburger. Right cluster has one primary action + browse via hamburger.
- **≥ 768px: full desktop nav + right cluster.** (Was 1024px.)

Concretely — every `lg:` breakpoint that controlled header-mobility became `md:`. Language switcher now shows at tablet+ (was desktop-only).

## What's NOT in this release

- **Video hero** — v0.27.0 lands the admin-controllable video slot per module + homepage.
- **Module page cuts** — module landing pages (`/dawa`, `/retail`, etc.) still have their old section count. They inherit the "cards everywhere" problem. Follow-up.
- **`/about` page** — where Founder Note will live. Follow-up.
- **Real customer testimonials** — need 20+ real named customers before ThreeQuotes reads as social proof. Currently pretending to have that is worse than not showing it.

## Verification

- website tsc clean · website `next build` clean · desktop tsc clean · vitest 455/455 unchanged (no desktop code touched).
- Homepage still renders on all locales — cut sections were removed from the JSX, no imports left dangling.
