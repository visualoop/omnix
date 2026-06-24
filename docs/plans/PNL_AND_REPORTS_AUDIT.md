# Profit/loss bug + report COGS audit + UI polish

**Status:** plan only — no code yet.

---

## 1. The P&L bug (real, confirmed in `services/accounting.ts`)

User reports: bought items at KES 20, sold at KES 100, sold 50 units → P&L shows ≈ KES 50,000 profit.
Expected gross profit = (100 − 20) × 50 = **KES 4,000**.
Actual P&L treats COGS as 0, so gross profit = revenue = **KES 5,000** (per unit) × 10 (rounding) ≈ what the user saw.

### Root cause
`services/accounting.ts` line ~237 computes COGS as:
```sql
SELECT SUM(COALESCE(b.buying_price, 0) * si.quantity)
FROM sale_items si
LEFT JOIN batches b ON b.id = si.batch_id
```

When `si.batch_id` is `NULL` (sales not linked to a specific batch — common for retail products without batch tracking, or pre-batch-tracking sales), the LEFT JOIN gives `b.buying_price = NULL`, `COALESCE → 0`, so **COGS = 0** and **gross profit = full revenue**.

The same accounting.ts file's `returned_cogs` query already uses the right fallback:
```sql
COALESCE(
  b.buying_price,
  (SELECT b2.buying_price FROM batches b2 WHERE b2.product_id = sri.product_id ORDER BY b2.received_at DESC LIMIT 1),
  0
)
```

So we know the fix pattern. Just isn't applied to the COGS query.

### Fix plan
A 4-step COGS resolution per sale_item:
1. `batches.buying_price` if `batch_id` is set (today's behaviour)
2. Most-recent batch for that product (already used by returns)
3. `products.cost_price` field if set (default cost when no batch)
4. Variant cost if `variant_id` is set (`product_variants.cost_price`)
5. `0` only if all four miss (warn in audit log)

This becomes a small SQL helper `cogsExpr(saleItemAlias)` reused by every report that needs cost.

### Other reports that probably have the same gap
- `services/reports.ts` — sales summary, top products
- `pages/inventory-reports.tsx` — stock valuation, dead stock
- `pages/daily-operations.tsx` — daily margin
- `services/z-report.ts` — daily P&L on shift close
- Any "margin", "profit", "GP%" column anywhere in the app

Fix: ship the helper once in `services/cogs.ts`, replace ad-hoc cost queries everywhere.

### Tests
Add `tests/services/cogs.spec.ts` with cases:
- Sale linked to batch → uses batch buying_price
- Sale not linked, product has 1 batch → uses that batch
- Sale not linked, product has multiple batches → uses most recent
- Sale not linked, no batches, product.cost_price set → uses product cost
- Sale not linked, no batches, no product cost → COGS = 0 + warning logged
- Variant sale with variant.cost_price → uses variant cost

---

## 2. UI polish

### 2a — Cmd+K trigger uneven padding
In `src/components/layout/sidebar.tsx` the search button is `h-8 px-2 flex items-center`. The icon + kbd appear visually higher than the bottom edge because `<kbd>` has its own border that counts toward optical baseline.

Fix: explicit `py` so vertical breathing is symmetric, and `align-items: center` on the inner row.

### 2b — Inventory icon replacement
`Package` (from current Phosphor import) — user wants it gone. Replace with one of:
- `ShelfBox` (Phosphor) — shelf-and-box metaphor, on-brand for retail/dawa/hardware
- `Cube` (Phosphor) — clean geometric, generic
- `Stack` (Phosphor) — stacked items, also generic
- `Boxes` (Lucide) — but desktop is on Phosphor only

Recommend `ShelfBox`. Sweep every reference to the Package import that's used for inventory only. Other modules (POS sale, supplier, etc.) might also import Package — leave those unless they're inventory-related.

### 2c — Inventory column auto-map test coverage
`pages/import-products.tsx` has the auto-map. No tests today.

Add `tests/import/automap.spec.ts` — feed CSV header rows like:
- `name,buy,sell,qty` → maps to product_name, cost_price, sell_price, stock_qty
- `Product Name,Cost,Price,Quantity` → same
- Mixed-case + extra whitespace
- Localised headers (Swahili: `Bidhaa,Bei ya Kununua,Bei ya Kuuza`)
- Garbage headers → returns suggestions, not crash

---

## 3. Tasks added to tracker

| # | Task |
|---|---|
| 34 | Build `services/cogs.ts` helper — 4-step cost resolution (batch → recent batch → product.cost → variant.cost → 0+warn) |
| 35 | Replace COGS query in `services/accounting.ts` with the helper, add unit tests (6 cases) |
| 36 | Audit `services/reports.ts` + `pages/inventory-reports.tsx` + `pages/daily-operations.tsx` + `services/z-report.ts` for ad-hoc cost queries; replace with helper |
| 37 | Fix Cmd+K sidebar trigger vertical padding |
| 38 | Replace inventory icon (`Package` → `ShelfBox`) — grep + targeted swap so only inventory-context occurrences change |
| 39 | Tests for inventory column auto-map (CSV import) — 6+ cases including localised headers |
| 40 | Regression test: a P&L test that fails if gross_profit equals revenue when COGS should be > 0 |

Sprint impact: ~2 working days. Critical because P&L is what owners use to decide whether to keep the product. Wrong P&L = wrong decisions.

---

## What this plan does NOT do

- Doesn't introduce a "weighted average cost" model. Ships moving-FIFO via "most-recent batch" which matches what the returns code already does. WAC is a separate cycle.
- Doesn't change schema. The `products.cost_price` and `product_variants.cost_price` columns already exist; we just start reading them.
- Doesn't add a "recompute past P&L" migration. Past sales whose batches are gone stay at COGS=0 in history; only new sales get the right resolution.

End of plan.
