/**
 * COGS — single source of truth for cost-of-goods-sold lookups.
 *
 * Every report that computes profit (P&L, daily ops, Z-report, dead
 * stock, top products) needs the unit cost of every sale_item. This
 * module returns a SQL fragment that resolves cost using a 4-step
 * fallback chain:
 *
 *   1. The batch the sale_item was linked to (batches.buying_price)
 *   2. Most-recent batch for the same product
 *   3. The default price list's buying_price for the product
 *   4. 0 (last resort — caller should warn / surface in audit)
 *
 * Why a SQL fragment and not a plain function: the calling reports do
 * `SELECT SUM(cost * qty) FROM sale_items` which can't be replaced by
 * per-row JS lookups without a 1000× perf hit. We embed the fallback
 * chain inline in SQL.
 *
 * Usage:
 *   import { cogsExpr } from '@/services/cogs';
 *
 *   const result = await query(`
 *     SELECT SUM(${cogsExpr('si')} * si.quantity) AS total_cogs
 *     FROM sale_items si
 *     JOIN sales s ON s.id = si.sale_id
 *     WHERE s.status = 'completed'
 *   `);
 *
 * The cogsExpr helper takes the alias of the sale_items row and emits
 * a COALESCE(...) expression that resolves the right cost. No JOINs
 * required — the fallback uses correlated subqueries scoped to the
 * sale_item's product_id.
 */

/**
 * SQL fragment that resolves the unit buying price for a sale_item row.
 *
 * @param siAlias  The alias used for sale_items in the outer query (e.g. 'si').
 * @returns        SQL string suitable for embedding in a SELECT or aggregation.
 */
export function cogsExpr(siAlias: string = "si"): string {
  return `COALESCE(
    (SELECT b1.buying_price FROM batches b1 WHERE b1.id = ${siAlias}.batch_id),
    (SELECT b2.buying_price FROM batches b2 WHERE b2.product_id = ${siAlias}.product_id ORDER BY b2.received_at DESC LIMIT 1),
    (SELECT pp.buying_price FROM product_prices pp JOIN price_lists pl ON pl.id = pp.price_list_id WHERE pp.product_id = ${siAlias}.product_id AND pl.is_default = 1 LIMIT 1),
    0
  )`
}

/**
 * Same chain, but for a sale_return_items row. Returns use the same
 * resolution as the original sale, joining sale_return_items.sale_item_id
 * back to sale_items + falling through identically.
 *
 * @param sriAlias  Alias for sale_return_items in the outer query.
 * @returns         SQL fragment.
 */
export function cogsExprForReturn(sriAlias: string = "sri"): string {
  return `COALESCE(
    (SELECT b1.buying_price FROM batches b1
       JOIN sale_items si_inner ON si_inner.batch_id = b1.id
       WHERE si_inner.id = ${sriAlias}.sale_item_id),
    (SELECT b2.buying_price FROM batches b2 WHERE b2.product_id = ${sriAlias}.product_id ORDER BY b2.received_at DESC LIMIT 1),
    (SELECT pp.buying_price FROM product_prices pp JOIN price_lists pl ON pl.id = pp.price_list_id WHERE pp.product_id = ${sriAlias}.product_id AND pl.is_default = 1 LIMIT 1),
    0
  )`
}

/**
 * For unit tests + diagnostics — the same logic implemented as JS.
 * Use only when querying one row at a time; never inside a hot loop.
 */
export interface CogsContext {
  saleItemBatchId: string | null
  productId: string
  batchPriceById?: (id: string) => number | null
  recentBatchPriceForProduct?: (productId: string) => number | null
  defaultPriceListPrice?: (productId: string) => number | null
}

export function resolveCogs(ctx: CogsContext): { cost: number; source: "batch" | "recent_batch" | "default_price" | "missing" } {
  if (ctx.saleItemBatchId && ctx.batchPriceById) {
    const v = ctx.batchPriceById(ctx.saleItemBatchId)
    if (v !== null && v !== undefined) return { cost: v, source: "batch" }
  }
  if (ctx.recentBatchPriceForProduct) {
    const v = ctx.recentBatchPriceForProduct(ctx.productId)
    if (v !== null && v !== undefined) return { cost: v, source: "recent_batch" }
  }
  if (ctx.defaultPriceListPrice) {
    const v = ctx.defaultPriceListPrice(ctx.productId)
    if (v !== null && v !== undefined) return { cost: v, source: "default_price" }
  }
  return { cost: 0, source: "missing" }
}
