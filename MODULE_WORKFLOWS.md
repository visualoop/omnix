# Omnix — Module Workflows & POS Interaction

A workflow analysis of how the four trade modules (Retail, Pharmacy/Dawa,
Hardware, Hospitality) interact with the shared POS. Verified against the
codebase (`src/services/sales.ts`, `src/services/hospitality.ts`,
`src/services/retail.ts`, `src/services/pharmacy.ts`,
`src/services/hardware.ts`).

> **One-line summary:** Omnix uses a single, consistent ERP pattern — every
> module funnels into one POS checkout (`completeSale`) which is the *only*
> place money is collected, the eTIMS receipt is issued, and inventory is
> deducted. Modules differ only in *what* they hand the POS and *when*.
> Hospitality is the one module that genuinely behaves differently, and that
> difference is the main inconsistency risk.

---

## The core pattern (shared by all four)

Hub-and-spokes. The **Core** owns inventory, customers, payments, tax/eTIMS,
and the sale record. The **POS checkout (`completeSale`) is the chokepoint**:

- It is always the last step.
- It always collects payment.
- It always issues the receipt and signs the eTIMS invoice.
- It always deducts inventory **at the moment the sale is completed**.

Each module is a *front* that produces a "thing to be sold" and routes it to
the POS — either a direct walk-in sale, or a **source document**
(`source_type` / `source_id` on the sale) that the POS later converts:
prescription, quotation, layby, special order, hospitality order, folio.

The sale is never "completed" anywhere except the POS.

---

## Retail

| # | Question | Answer |
|---|----------|--------|
| 1 | Workflow | Customer brings items → cashier scans/builds cart → pay → receipt. Deferred variants: **layby** (instalments, goods held) and **special order** (item ordered in, collected later). |
| 2 | Module responsibility | Catalogue (brands/variants/UOM), promotions, loyalty, returns, stock takes, layby + special-order bookkeeping. |
| 3 | POS involvement | Immediately for walk-in. For layby/special-order, at each payment and at final collection. |
| 4 | Pending or self-complete? | Walk-in completes directly at POS. Layby + special orders are **pending source documents** closed by the POS. |
| 5 | Payment | **POS.** |
| 6 | Receipt / invoice | **POS** (eTIMS-signed). |
| 7 | Inventory deducted | At sale completion (FIFO batch, or `product_variants.stock_qty` for variant lines). |
| 8 | Cancellations / refunds | Return against the original sale → stock returns, credit/refund recorded. |
| 9 | Same pattern? | **Yes** — retail is the reference implementation. |

---

## Pharmacy (Dawa)

| # | Question | Answer |
|---|----------|--------|
| 1 | Workflow | Customer presents prescription (or OTC) → pharmacist captures prescriber/licence/patient/drugs, checks interactions + expiry → dispense → POS takes payment (cash, M-Pesa, or **insurance NHIF/SHA/private with copay split**) → receipt. |
| 2 | Module responsibility | Prescription capture, controlled-drug ledger, expiry/batch tracking, drug interactions, insurance claim prep, PPB compliance. |
| 3 | POS involvement | After the prescription is prepared/validated — at dispense-and-pay. |
| 4 | Pending or self-complete? | Creates a **prescription source document**; POS completes the sale and, on completion, marks the prescription dispensed (`dispensePrescription`). |
| 5 | Payment | **POS** — including the insurance claim/copay split. |
| 6 | Receipt / invoice | **POS** (eTIMS) + insurance claim record on the pharmacy side. |
| 7 | Inventory deducted | At sale completion (batch-level, soonest-expiry-first) — same as retail. |
| 8 | Cancellations / refunds | Return against the sale; controlled-substance entries retained (legal); insurance claim reversed. |
| 9 | Same pattern? | **Yes** — adds compliance + an insurance payment path, but the POS is still the chokepoint. |

---

## Hardware

| # | Question | Answer |
|---|----------|--------|
| 1 | Workflow | Often starts as a **quotation** for a contractor's materials list → revised → accepted → converts to sale. Also supports **contractor accounts** (buy on credit, settle later) and tiered/bulk pricing. |
| 2 | Module responsibility | Quotations, delivery notes, contractor accounts (credit limits + aged receivables), tiered pricing, sales commissions. |
| 3 | POS involvement | When the quote is accepted/converted — at pay-or-charge-to-account. Walk-in counter sales go straight through the POS like retail. |
| 4 | Pending or self-complete? | Creates a **quotation source document**; POS completes the sale and marks the quote paid/converted (`markQuotePaidFromPos`). |
| 5 | Payment | **POS** — including "charge to contractor account" (credit), which posts to the account ledger via `postCharge` instead of taking cash now. |
| 6 | Receipt / invoice | **POS** (eTIMS); delivery notes are a hardware-side document. |
| 7 | Inventory deducted | At sale completion. |
| 8 | Cancellations / refunds | Return against the sale; credit sales reverse the ledger posting. |
| 9 | Same pattern? | **Yes** — quotation is a richer pending document than retail's special order, but still resolves at the POS. |

---

## Hospitality / Restaurant — the divergent one

**Order flow (waiter → kitchen):** A waiter opens a **table order**
(`hospitality_orders`) and adds menu items (`hospitality_order_items`). Items
fire to the **kitchen (KOT / kitchen display)** so cooking can start — **while
the table is still seated, before any payment.**

**Prepare before or after payment?** **Before.** The kitchen cooks on the
order, not on payment. The customer eats first and pays at the end (or onto a
room **folio** in a hotel). This is the *opposite* of retail/pharmacy/hardware,
where nothing of value leaves until the POS sale is done.

**Recipes / Bill of Materials?** **Yes.** Menu items are defined by recipes
(`recipe_ingredients`) — a BOM of raw ingredients with wastage % and food-cost.

**Raw ingredients or finished meals deducted?** **Raw ingredients.** A
"Chicken & chips" sale does not decrement a "Chicken & chips" stock item — it
explodes the recipe and decrements the underlying ingredients. Finished meals
are not stocked items.

**When does ingredient deduction occur?** **At POS sale completion**, via
`consumeRecipe(menu_item_id, qty, saleId)` called from `completeSale`. Menu
lines (`menu_item_id` set) deliberately **bypass the normal batch-stock check**
and instead consume ingredients through the recipe path — at the same instant
retail/pharmacy deduct their batches.

**Kitchen → POS handover:** The served table order is handed to the POS as a
**pending source document**. The cashier pulls it up, applies service charge /
tips, takes payment, completes the sale, then `markOrderPaidFromPos` sets the
order `status = 'paid'`, marks items `served`, frees the table, and allocates
the waiter's service charge.

**Should the POS be the final place payment is collected + sale completed?**
**Yes — and it is.** Table orders and folios are pending documents; payment,
receipt, eTIMS, tips, service charge, **and** the ingredient deduction all
happen at the POS at finalisation. The kitchen never completes anything
financially.

---

## Comparison — one pattern, one meaningful divergence

**Shared backbone (all four):** modules produce things to sell (directly, or
as a pending document — prescription, quote, layby, special order, table
order, folio), and the **POS is the single place that collects payment, issues
the eTIMS receipt, and deducts inventory at completion.** One "money + stock +
tax" path → reports, compliance, and reconciliation all see the same truth.
This consistency is the system's core strength.

### Where hospitality differs — and the real risk

In **retail, pharmacy, and hardware**, *nothing of value leaves the business
before the POS sale completes.* Abandon the sale → no stock moved, no money
expected.

**Hospitality breaks that assumption:** the food is physically cooked
(ingredients consumed in the real world) **before** payment, but the system
only deducts those ingredients when the POS sale completes (`consumeRecipe` at
`completeSale`). That gap creates three failure modes:

1. **Walk-outs / unpaid tables** — kitchen used real ingredients, but if the
   table order is never paid at the POS, the system never deducts that stock.
   On-hand inventory silently overstates reality; food cost is understated.
2. **Voids / comps after cooking** — if an order is cancelled *after* the
   kitchen made it, the same gap appears. `markOrderPaidFromPos` marks items
   `served`/`voided` but there is **no ingredient write-off path on void** —
   so a comped-after-cooking dish never leaves inventory in the system.
3. **Partial / progressive orders** — a table that orders more through the
   evening accumulates on one order; if deduction fires only at final
   settlement, mid-service stock counts won't reflect what's already cooked.

The other three modules have no such exposure because their value transfer and
the POS completion are the same instant.

### Recommendation (design)

Keep the POS as the single completion point — that is correct and consistent.
For hospitality specifically, decide deliberately *when* ingredient deduction
fires. Two coherent models:

- **Option A (recommended):** deduct ingredients when the **KOT is confirmed**
  (food committed to cook), and treat a later void/walk-out as a **wastage
  write-off**, not a stock reversal. Inventory then always reflects what
  actually left the kitchen, regardless of whether the table pays — while
  payment, receipt, and eTIMS still happen only at the POS like every other
  module.
- **Option B (current behaviour):** keep deduction at POS-completion, but add
  an explicit **fire/wastage path** on voided-after-cooked orders. Without it,
  hospitality inventory will drift over time in a way the other three modules
  never do.

**Verdict:** the ERP follows one consistent workflow across all four modules.
The only behavioural divergence is hospitality's cook-before-pay reality vs.
deduct-on-pay accounting. It does not break the system today, but left
unaddressed it will cause hospitality inventory + food-cost drift that the
other modules are structurally immune to.

---

### Source-document map (how each module reaches the POS)

| Module | Source document | POS close action |
|--------|-----------------|------------------|
| Retail (walk-in) | none — direct sale | `completeSale` |
| Retail (layby) | layby | `completeLaybyFromPos` |
| Retail (special order) | special order | `completeSpecialOrderFromPos` |
| Pharmacy | prescription | `dispensePrescription` |
| Hardware (quote) | quotation | `markQuotePaidFromPos` |
| Hardware (credit) | — | `postCharge` (account ledger) |
| Hospitality (dine-in) | hospitality order | `markOrderPaidFromPos` |
| Hospitality (hotel) | room folio | folio settle → `completeSale` |

_Generated from a scan of the Omnix codebase. The one fact worth acting on is
the hospitality ingredient-deduction timing (Option A vs B above)._
