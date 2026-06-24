# PDFs + reports + purchase-order lifecycle

**Status:** plan only — no code yet.
**Scope:** desktop app (`/src/`).
**Why:** the desktop generates several PDFs (invoice, payslip, controlled-register, Z-report) but has zero tests covering them. Anything that prints to a customer or to the regulator should be regression-locked.

---

## 1. Inventory of PDF / print surfaces

### Already shipped (live in `src/services/` + `src/pages/`)

| Surface | File | Used by | Test coverage |
|---|---|---|---|
| Sales invoice / receipt | `services/invoice-pdf.ts` | POS, invoicing, claims | none |
| Payslip | `services/payslip-pdf.ts` | Payroll module | none |
| Controlled drugs register (PPB) | `pages/controlled-register.tsx` | Dawa pharmacy | none |
| Z-report (end-of-day) | `services/z-report.ts` + `pages/zreport.tsx` | POS / shift close | none |
| Purchase order | `pages/purchase-orders.tsx` | Procurement | none |

### Likely missing (to confirm during audit)

| Surface | Confirmed? | Why we need it |
|---|---|---|
| Hardware quotation | ⬜ flagged in user feedback | "create quote" today is a dead-end |
| Delivery note | ⬜ | Hardware + Retail wholesale |
| Goods Received Note (GRN) | ⬜ | Procurement closes loop with PO |
| Stock-take variance report | ⬜ | Stock take has UI but no PDF export |
| Stock-on-hand report | ⬜ | Inventory snapshot for tax / insurance |
| Aged receivables (debtors) | ⬜ | Required for credit decisioning |
| Aged payables (creditors) | ⬜ | Required for cash-flow planning |
| Sales summary by branch / period | ⬜ | Owners want a printable monthly view |
| VAT3 return PDF | ⬜ | Submitted to KRA monthly |
| P9 payroll export | ⬜ | Annual employee tax cert |
| P10 payroll batch | ⬜ | Monthly PAYE filing |
| SHA / NHIF claim batch print | ⬜ | Hospitals + clinics need a printable claim cover sheet |
| Bank reconciliation report | ⬜ | Banking module |
| Petty-cash voucher | ⬜ | Petty-cash module exists; voucher print may be missing |

We'll fill in confirmed status during Phase 1 below.

---

## 2. Test strategy

PDFs are deterministic if you control the input. We'll use:

- **vitest** as the test runner (already in use).
- **`@/services/<name>-pdf.ts`** modules export a `renderToBuffer(input)`
  function. Tests call it with a fixed snapshot of input data + assert
  against the resulting Uint8Array.

Three layers per PDF:

### Layer 1 — content snapshot
Extract text from the PDF (using `pdf-parse` or `pdfjs-dist`'s text
extractor) and assert specific lines appear, in the right order:
- Customer name
- Each line item with quantity + price + line total
- Subtotal, VAT, total
- Payment method
- KRA CU + CU invoice number (eTIMS)
- Receipt date
- Footer ("Thank you" + shop info + KRA PIN)

This catches "the line is missing" regressions without locking us into
exact pixel positioning.

### Layer 2 — structural invariants
- File signature is `%PDF-1.x`
- Has at least one page
- Total bytes within sane bounds (e.g. 5–500 KB for a typical receipt)
- All text on the page is selectable (catches accidentally-rasterised
  receipts that copy/paste as garbage)

### Layer 3 — golden snapshot (optional, opt-in per PDF)
A baseline PDF lives in `tests/fixtures/golden/<name>.pdf`. The test
re-renders with the same input + diffs the byte stream. Only
appropriate for PDFs we've manually approved as "the one true
layout" (probably just the receipt + the Z-report).

### Setup work
1. Refactor each PDF service so it exposes a pure
   `render(input) → Uint8Array` (no side effects, no DB calls inside).
2. Add `tests/fixtures/pdf-input/<name>.json` with a representative
   payload (one line item, multi-line, with insurance, with discount,
   with VAT exemption, etc.).
3. Add `tests/pdf/<name>.spec.ts` — at least one happy-path test +
   one edge case per PDF.
4. Add `pnpm test:pdf` script (vitest filter on `tests/pdf/*`).
5. Wire into CI so a broken PDF fails the build before deploy.

---

## 3. Purchase Order lifecycle audit

### What "works properly" means

A PO has to flow through these states cleanly:

```
draft → sent → partially-received → fully-received → closed
              ↘ cancelled
```

For each transition we need:

| Transition | Action | Side effects | PDF |
|---|---|---|---|
| draft → sent | Owner signs off | locks the line items, snapshots prices, emails / WhatsApps PDF to supplier | PO PDF |
| sent → received (full) | Cashier records GRN matching PO line-for-line | stock += GRN qty; PO marked closed; supplier balance += total | GRN PDF |
| sent → received (partial) | GRN with some lines short | stock += received qty; PO stays sent until remainder arrives or owner closes early | GRN PDF |
| received → closed (early) | Owner accepts incomplete delivery | remaining lines marked "won't fulfil"; supplier balance stays at received total | (re-issue PO PDF marked CLOSED) |
| any → cancelled | Before any GRN | PO voided; no stock change | (re-issue PO PDF marked CANCELLED) |

### What's likely broken / missing today

(needs audit during implementation)

- **GRN flow**: `pages/purchase-orders.tsx` exists. Is there a real GRN
  page that ties qty-received back to the PO line? Or is "receive
  stock" a separate freeform flow?
- **Partial receipts**: does the system handle a 100-unit PO where
  only 80 land?
- **Price snapshot**: does the PO lock the unit cost at sign-off? Or
  does it re-read from the catalogue (which would let supplier price
  changes silently rewrite history)?
- **Three-way match**: PO ↔ GRN ↔ supplier invoice. Standard
  procurement control. Is this enforced anywhere?
- **Backorder handling**: when a partial PO closes early, are the
  unfulfilled lines reorderable from a single button or does the
  owner have to remember and re-key?
- **Email / WhatsApp send**: does the PDF actually go out, or does
  it just download to the local file system?
- **Approvals**: a PO above a threshold (e.g. KES 100k) — does it
  require a second-cashier sign-off? The retail variant doesn't need
  this; hardware contractor accounts probably do.
- **Currency on PO**: imported items priced in USD vs local items in
  KES. Mixed-currency POs are common in pharmacy + hardware. Is this
  supported?
- **Discount terms**: 2/10 net 30 (Western) vs Kenyan informal
  ("pay in 14 days; small mark-down for cash"). What does the schema
  store?
- **Returns to supplier**: damaged goods sent back. Is there a
  reverse-GRN flow, or do owners have to manually adjust stock?

### Test strategy for the PO lifecycle

Integration tests (vitest, not e2e) that exercise the full flow
against a fresh in-memory SQLite:

```
1. createSupplier()
2. createPO({ supplier, lines: [...] })
3. assertPO({ status: 'draft', total })
4. sendPO(poId)
5. assertPO({ status: 'sent', sentAt: defined })
6. recordGRN(poId, [{ line, qty }, ...])
7. assertStock({ delta: ... })
8. assertPO({ status: 'partially-received' | 'fully-received' })
9. closePOEarly(poId) OR recordGRN(poId, [remaining lines])
10. assertPO({ status: 'closed' })
```

Cancellation flow + reverse-GRN flow each get their own spec.

---

## 4. Phasing

### Phase 1 — audit (1 day)

- Open `pages/purchase-orders.tsx` + walk every code path.
- Document every branch in `docs/plans/PO_LIFECYCLE_FINDINGS.md`.
- Confirm the missing-PDF list above against actual code.
- Output: a list of "definitely broken" + "definitely missing" items.

### Phase 2 — refactor PDF services for testability (1 day)

- Each `services/*-pdf.ts` exposes `render(input): Uint8Array`.
- Move all DB calls out of the renderers.
- Move file-save calls out (saveAs is now a separate
  `download(blob, filename)` helper that the page calls *after* render).

### Phase 3 — write tests (2 days)

- Layer-1 content snapshot tests for every existing PDF (5 services).
- Layer-2 structural-invariant tests for every PDF.
- Layer-3 golden PDFs for invoice + Z-report only.

### Phase 4 — fill in missing PDFs (2–3 days)

Priority order based on user impact:
1. Hardware quotation (already a confirmed user complaint)
2. GRN
3. Stock-take variance report
4. Aged receivables / payables
5. VAT3 return PDF
6. P9 / P10 payroll exports

Lower priority, defer to next cycle:
- SHA / NHIF claim batch
- Bank reconciliation report
- Sales summary by period

### Phase 5 — purchase-order lifecycle hardening (2 days)

After audit findings, fix the broken transitions. Each PR is one
state-machine concern:
- Partial receipts
- Price snapshot at sign-off
- Three-way match
- Reverse-GRN
- Mixed-currency POs

### Phase 6 — wire into CI (half-day)

- Add `pnpm test:pdf` to the desktop CI matrix.
- Add `pnpm test:po` for PO lifecycle specs.
- Block deploy on either failing.

---

## 5. Tasks (added to master tracker)

| # | Task |
|---|---|
| 1 | Phase 1 — audit every PO code path + every existing PDF surface, write findings doc |
| 2 | Phase 2 — refactor 5 PDF services into pure `render(input)` shape |
| 3 | Phase 3 — vitest content + structural tests for invoice / payslip / controlled-register / Z-report / PO |
| 4 | Phase 3 — golden snapshot for invoice + Z-report |
| 5 | Phase 4 — Hardware quotation PDF |
| 6 | Phase 4 — GRN PDF |
| 7 | Phase 4 — Stock-take variance PDF + Aged receivables / payables PDFs |
| 8 | Phase 4 — VAT3 return + P9 / P10 payroll PDFs |
| 9 | Phase 5 — PO partial-receipts + price snapshot + reverse-GRN + mixed-currency |
| 10 | Phase 5 — three-way match enforcement + approval-threshold workflow |
| 11 | Phase 6 — wire PDF + PO test suites into desktop-tests.yml CI workflow |

Total: ~9 working days.

---

## What this plan explicitly does NOT do

- **Doesn't move PDFs to the website.** They remain desktop-side. Only
  if a customer requests an emailed receipt do we lift to the website,
  and that's a v0.10+ feature.
- **Doesn't introduce new PDF libraries.** The existing `jspdf` + `pdf-lib`
  stack is fine.
- **Doesn't adopt React-PDF for desktop.** The desktop's PDFs are a
  hot-path; jspdf's imperative API is faster + smaller.
- **Doesn't add e2e PDF tests.** Layer-1 content extraction + Layer-3
  golden snapshots cover what e2e would, with much less flake.
- **Doesn't change KRA receipt content.** The CU signing logic is
  separate from PDF rendering — receipts get their CU number from
  the eTIMS service, the PDF just lays it out.

End of plan. Awaiting greenlight before any code is written.
