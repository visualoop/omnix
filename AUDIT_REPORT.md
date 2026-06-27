# Omnix ERP & POS — Full Codebase Audit

A complete scan of the Omnix desktop application (Tauri v2 + React + SQLite),
covering every module, the shared core, and the cross-cutting concerns that
decide whether a buyer trusts the system with their money and stock.

- **Scope:** 313 source files, 84 service modules, 49 DB migrations.
- **Verdict up front:** The architecture is genuinely strong — one consistent
  POS chokepoint, 150+ indexes, a schema-stale audit in CI, real compliance
  (eTIMS, PPB, insurance), and now production DB tuning. **But there are a
  handful of correctness gaps in the money/stock write path that, while rare,
  are exactly the kind of thing that erodes trust when they bite.** They are
  fixable and listed by priority below.

Severity key: 🔴 Critical (can corrupt money/stock) · 🟠 High (visible
inconsistency / compliance) · 🟡 Medium (drift over time / UX) · 🟢 Low (polish).

---

## 1. What's already excellent

These are real strengths worth keeping and marketing:

- **Single POS chokepoint.** Every module (retail, pharmacy, hardware,
  hospitality) funnels into `completeSale()` — one place for payment, eTIMS,
  and stock deduction. Reports, tax, and reconciliation all see one truth.
- **Source-document pattern is consistent.** Prescriptions, quotations,
  laybys, special orders, table orders, and folios are all pending documents
  the POS converts — clean and uniform.
- **COGS is centralised** (`cogs.ts`) with a 4-step fallback chain in SQL, so
  every profit report (P&L, Z-report, dead stock) computes cost identically.
- **Tax is a single resolver** (`tax.ts`) with off/inclusive/exclusive modes,
  cached, used by POS + receipts + reports + eTIMS.
- **Schema-stale audit** (`scripts/audit-codebase.mjs`) runs in CI and blocks
  queries that reference moved columns or would scan unindexed.
- **Compliance depth:** KRA eTIMS auto-signing, PPB controlled-drug register,
  NHIF/SHA + private insurance with copay split, VAT3/P9/P10 returns.
- **DB tuning + maintenance** (recently added): WAL, mmap, 16MB cache, daily
  sales rollup, churn pruning, `PRAGMA optimize`.
- **Multi-device LAN sync** with client/master proxying.
- **Licensing + entitlement gating** per machine + per module.

---

## 2. 🔴 Critical — the sale write path is not transactional

**File:** `src/services/sales.ts` → `completeSale()`

`completeSale` performs a *sequence* of independent writes with no
`BEGIN…COMMIT` wrapper:

1. `INSERT INTO sales`
2. loop `INSERT INTO sale_items` + deduct `batches` / `product_variants`
3. loop `INSERT INTO payments` (+ mirror to `bank_transactions`)
4. fire-and-forget eTIMS signing

If the process crashes, the disk errors, or any single statement throws
mid-way, the database is left in a **partial state**: stock deducted but no
payment row, or a sale with no items, or a sale with items but no bank mirror.
There is no rollback. On a busy till with power cuts (the target market), this
*will* eventually happen and produces numbers that don't reconcile — the single
most trust-damaging failure a POS can have.

**The DB layer (`src/lib/db.ts`) exposes no transaction primitive at all** —
`query()` and `execute()` are the only methods, so no service can be atomic
today.

**Fix:** add a `transaction(fn)` helper to `db.ts` (sqlx/tauri-plugin-sql
supports it) that wraps a unit of work in `BEGIN IMMEDIATE … COMMIT` with
`ROLLBACK` on throw, and wrap `completeSale`, `voidSale`, and every other
multi-write operation (stock transfers, payroll runs, GRN, returns) in it.

---

## 3. 🔴 Critical — `voidSale` bugs (stock + compliance)

**File:** `src/services/sales.ts` → `voidSale()`

Three distinct problems:

1. **Phantom stock for hospitality voids.** `voidSale` restores *every*
   sale_item as batch stock, including hospitality `menu_item` lines that were
   never batch-deducted (they consumed recipe ingredients). Voiding a
   restaurant sale therefore **invents inventory** — it creates a
   `VOID-RESTORE` batch of a menu product that has no real stock.
   → Skip lines where `menu_item_id` is set; reverse recipe consumption
   instead (or write off as wastage — see §5).

2. **Real bug: `const restore = Math.min(remaining, remaining)`.** This always
   equals `remaining`. The intent was to cap by batch capacity. Today it dumps
   the entire quantity onto whichever batch is iterated first, so FIFO
   provenance is wrong (the totals net out, but batch history lies).

3. **Void doesn't reverse money or eTIMS.** Voiding restores stock but leaves
   the `payments` rows, the mirrored `bank_transactions` deposit, **and the
   signed eTIMS invoice** in place. So a voided sale still shows as banked
   revenue and a live KRA invoice. That's both a reconciliation break and a
   tax-compliance problem (KRA expects a credit note / void signal).
   → Void must also: mark/refund payments, reverse the bank mirror, and submit
   an eTIMS void/credit. And it must be transactional (§2).

---

## 4. 🟠 High — money stored as floating point (`REAL`)

**Files:** all financial migrations (`003_sales.sql` etc.) — `subtotal`,
`discount_amount`, `tax_amount`, `total`, `amount`, `quantity` are all `REAL`.

SQLite `REAL` is IEEE-754 double. Individual sales look fine, but **summing
millions of float amounts in reports accumulates rounding error**, and
inclusive-tax back-out (`total / 1.16`) produces values like `86.2068965…`
that get re-rounded inconsistently between the receipt, the report, and the
eTIMS line. Over a year this is the "the Z-report is off by 3 shillings"
complaint that makes an accountant distrust the whole system.

**Fix (no schema break required):** standardise rounding at every boundary —
store/compare money rounded to 2dp via a single helper, and compute tax with
integer-cents math in `tax.ts`/`computeTax`. Longer term, consider storing
amounts as integer cents. At minimum, add a money-rounding utility and use it
everywhere a total is persisted or compared.

---

## 5. 🟠 High — hospitality inventory drift (cook-before-pay)

**File:** `src/services/hospitality.ts` (`sendToKitchen`, `voidOrderItem`,
`consumeRecipe`) + `sales.ts`.

Ingredients are deducted only at **POS completion** (`consumeRecipe` from
`completeSale`), but the kitchen physically cooks at **KOT time**, before
payment. Documented fully in `MODULE_WORKFLOWS.md`. Net effect:

- **Walk-outs / unpaid tables** → food was cooked, ingredients consumed in
  reality, but never deducted in the system → on-hand stock overstates truth,
  food-cost % understated.
- **Items voided after cooking** (`voidOrderItem`) → no wastage write-off, so
  the ingredients silently never leave inventory.

The other three modules are immune because value transfer == POS completion.
**Fix:** deduct ingredients at KOT confirmation and treat voids/walk-outs as
wastage (the `recordWastage` function already exists — wire it into the void
path), OR keep POS-time deduction but add an explicit wastage write-off on
voided-after-fired items.

---

## 6. 🟠 High — negative-stock + concurrency race

**File:** `sales.ts` deduction loop.

The pre-flight stock check and the deduction are **separate, non-atomic
steps**. Two tills (LAN clients) selling the last unit of a product can both
pass the check, then both deduct — driving `batches.quantity` negative (the
variant path uses `MAX(0, …)` but the batch path does not clamp). Combined with
§2 (no transaction), concurrent selling on a shared master DB can oversell and
mis-attribute batches.

**Fix:** do the check + deduct inside one transaction with `BEGIN IMMEDIATE`
(serialises writers), and clamp batch quantity at 0 with an explicit
out-of-stock failure inside the txn.

---

## 7. 🟡 Medium — eTIMS signing is fire-and-forget

**File:** `sales.ts` → `signWithEtims(...).catch(console.error)`.

eTIMS signing is intentionally non-blocking (good for till speed), but a
failure is only `console.error`'d. There's an `etims_invoices` queue +
`retryQueuedInvoices`, so the plumbing exists — but if signing throws before
the queue row is written, the sale completes with **no eTIMS record and no
retry**, and nobody is told. A shop could rack up unsigned sales and discover
it at a KRA audit.

**Fix:** always enqueue the eTIMS intent *inside* the sale transaction (so it
can't be lost), then sign asynchronously from the queue with visible
retry/failure status on the dashboard.

---

## 8. 🟡 Medium — bank mirror can desync from payments

**File:** `sales.ts` payment loop → `recordTransaction` in a `try/catch` that
only logs.

Each payment is mirrored to `bank_transactions` for reconciliation, but the
mirror is best-effort: if it throws, the payment exists with no bank row, so
the reconciliation report silently under-counts. Same root cause as §2 — it
should be part of the sale transaction, or a reconciliation job should detect
and backfill orphaned payments.

---

## 9. 🟡 Medium — refund/return symmetry not verified end-to-end

Returns (`erp.ts createSaleReturn`), layby cancellation, and special-order
cancellation each restore stock and adjust money on their own paths. They were
not all confirmed to (a) be transactional, (b) reverse eTIMS, and (c) reverse
the bank mirror with the same rigor as a forward sale. Given §2/§3, assume the
same gaps until each is audited. **Recommend a dedicated pass** asserting that
every "undo" path is the exact mirror of its "do" path.

---

## 10. 🟡 Medium — insurance copay split trust

**File:** `insurance.ts` (`calculateCopay`, `createClaim`) + `payment-modal`.

The insurance flow splits a sale into claim portion + patient copay. Because
the sale total is float (§4) and the split is computed separately from the POS
total, a 1-cent mismatch between (copay + claim) and (sale total) is possible.
For insurance billing that's the kind of discrepancy that gets a claim
rejected. **Fix:** compute the split from integer cents and assert
`copay + claim === total` before writing the claim.

---

## 11. 🟢 Low — smaller items

- **`voidSale` FIFO history** (see §3.2) — cosmetic until someone audits batch
  provenance, but worth fixing with the rest of void.
- **AI call-log pruning** keeps only 90 days (`db-maintenance.ts`) — fine, but
  document it so nobody expects all-time AI history.
- **`sales_daily` rollup** only refreshes the last 7 days each run; a sale
  back-dated >7 days (rare) wouldn't roll up. Edge case; note it.
- **Float `quantity`** on `sale_items` allows fractional units (intended for
  weight/volume) but also allows `0.1+0.2` drift on summed quantities — minor.
- **Hardware credit (`postCharge`)** posts to the account ledger inside the
  same untransacted sale path — inherits §2.

---

## 12. Module-by-module consistency summary

| Module | Sale path | Pending doc | Stock timing | Void reverses stock? | Void reverses money+eTIMS? |
|--------|-----------|-------------|--------------|----------------------|----------------------------|
| Retail | `completeSale` | layby / special order | at completion ✅ | yes (non-txn) | ❌ (§3.3) |
| Pharmacy | `completeSale` | prescription | at completion ✅ | yes (non-txn) | ❌ (§3.3) |
| Hardware | `completeSale` | quotation / credit | at completion ✅ | yes (non-txn) | ❌ (§3.3) |
| Hospitality | `completeSale` | table order / folio | at completion ⚠️ (§5) | **creates phantom stock** (§3.1) | ❌ (§3.3) |

**One consistent ERP workflow? Yes** — the read/report/compliance side is
uniform and trustworthy. **The write/undo side has shared gaps** (no
transaction, void doesn't reverse money/eTIMS) plus hospitality's two unique
bugs (phantom void stock, cook-before-pay drift).

---

## 13. Recommended fix order (highest trust-per-effort first)

1. **Add `transaction()` to `db.ts`** and wrap `completeSale` + `voidSale`.
   (§2, §6) — biggest single trust win; everything else builds on it.
2. **Fix `voidSale`**: skip menu lines, fix the `Math.min` bug, reverse
   payments + bank mirror + eTIMS. (§3)
3. **Money rounding helper** used at every persist/compare boundary; integer-
   cents tax math. (§4, §10)
4. **Hospitality**: wire `recordWastage` into KOT-time deduction or the void
   path. (§5)
5. **eTIMS**: enqueue intent inside the sale txn; surface queue failures on the
   dashboard. (§7)
6. **Audit every refund/undo path** for do/undo symmetry. (§9)

None of these block a v1 demo, but #1–#3 should land before a customer runs
real money through it for months. They're the difference between "fast and
slick" and "fast, slick, and the books always balance."

---

_Generated from a full scan of the Omnix codebase. Findings reference exact
files/functions and were verified by reading the implementation, not inferred.
Companion doc: `MODULE_WORKFLOWS.md` (per-module workflow detail)._
