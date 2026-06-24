/**
 * Purchase order lifecycle hardening — partial receipts, reverse-GRN,
 * three-way match enforcement, approval-threshold workflow, mixed-
 * currency support.
 *
 * Companion to services/erp.ts. Lives separately because erp.ts is
 * already 700+ lines and these flows have their own state machine
 * + audit semantics worth isolating.
 *
 * Glossary:
 *   - PO: purchase_orders + purchase_order_items
 *   - GRN: goods_receipts + goods_receipt_items (one PO can have many)
 *   - Three-way match: PO total ≈ GRN total ≈ supplier-invoice total
 *   - Approval threshold: setting `purchasing.approval_threshold` in KES
 *
 * State machine for purchase_orders.status (existing values + new):
 *   draft → pending_approval (only if total >= threshold AND required=1)
 *   draft / pending_approval → approved
 *   approved → sent
 *   sent → partial → received (driven by GRN cumulative quantities)
 *   any → cancelled
 *
 * Mixed-currency:
 *   - PO carries `currency` + `exchange_rate` (units of base per unit
 *     of foreign). Line items stay in foreign currency. Stock cost
 *     records in batches.buying_price are converted to base at the
 *     exchange_rate stamped at GRN time.
 */
import { execute, query } from "@/lib/db"
import { getPurchaseOrder, updatePOStatus } from "@/services/erp"

// ─── Approval threshold workflow ──────────────────────────────────

export interface ApprovalSettings {
  thresholdAmount: number
  required: boolean
  toleranceDocPct: number
}

/**
 * Read approval-related settings. Defaults match migration 045.
 */
export async function getApprovalSettings(): Promise<ApprovalSettings> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN ('purchasing.approval_threshold','purchasing.approval_required','purchasing.three_way_tolerance_pct')`,
  )
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    thresholdAmount: parseFloat(map["purchasing.approval_threshold"] ?? "100000"),
    required: map["purchasing.approval_required"] !== "0",
    toleranceDocPct: parseFloat(map["purchasing.three_way_tolerance_pct"] ?? "1"),
  }
}

/**
 * Decide the PO status when transitioning out of draft. Used by the
 * "Send to supplier" handler in the UI:
 *
 *   - If total < threshold OR approval not required → "sent"
 *   - Otherwise → "pending_approval" (waits for approver action)
 *
 * Returns the new status the caller should write.
 */
export async function nextStatusFromDraft(poTotal: number): Promise<"sent" | "pending_approval"> {
  const cfg = await getApprovalSettings()
  if (!cfg.required) return "sent"
  return poTotal >= cfg.thresholdAmount ? "pending_approval" : "sent"
}

/**
 * Approve a PO that was put in pending_approval. Records the approver
 * + timestamp; transitions to "approved" so the next action (send) can
 * proceed. Throws if the PO isn't pending_approval.
 */
export async function approvePurchaseOrder(poId: string, approverUserId: string): Promise<void> {
  const result = await getPurchaseOrder(poId)
  if (!result) throw new Error("Purchase order not found")
  if (result.po.status !== "pending_approval") {
    throw new Error(`Cannot approve PO in status ${result.po.status}`)
  }
  await execute(
    `UPDATE purchase_orders SET status = 'approved', approved_at = datetime('now'), approved_by = ?1 WHERE id = ?2`,
    [approverUserId, poId],
  )
}

// ─── Reverse-GRN ───────────────────────────────────────────────────

/**
 * Reverse a goods receipt: removes the batches that were created,
 * rolls back the stock movements, decrements supplier balance_owed,
 * and re-opens the PO line received_quantity.
 *
 * Does NOT delete the GRN row — it stays in the audit trail with
 * `reversed_at` + `reversed_by` set, so the operation is visible.
 *
 * Refuses if any of the originally-received batches have already been
 * sold or transferred; the only way to back out of those is a stock
 * adjustment, not a reverse-GRN.
 *
 * @param grnId  The GRN to reverse.
 * @param userId User performing the reversal — recorded for audit.
 */
export async function reverseGoodsReceipt(grnId: string, userId: string): Promise<void> {
  const grnRows = await query<{
    id: string
    grn_number: string
    po_id: string | null
    supplier_id: string
    total: number
    reversed_at: string | null
  }>(`SELECT id, grn_number, po_id, supplier_id, total, reversed_at FROM goods_receipts WHERE id = ?1`, [grnId])
  const grn = grnRows[0]
  if (!grn) throw new Error("GRN not found")
  if (grn.reversed_at) throw new Error("GRN already reversed")

  // Find the batches that were created with this GRN as the reference.
  const batchRows = await query<{
    id: string
    product_id: string
    quantity: number
    buying_price: number
  }>(
    `SELECT b.id, b.product_id, b.quantity, b.buying_price
     FROM batches b
     JOIN goods_receipt_items gri ON
       gri.product_id = b.product_id
       AND gri.batch_number IS NOT DISTINCT FROM b.batch_number
       AND gri.unit_cost = b.buying_price
     WHERE gri.grn_id = ?1`,
    [grnId],
  )

  // Safety: if any batch has been partially consumed (quantity dropped
  // below received), refuse — those goods left the warehouse already.
  const griSums = await query<{ product_id: string; received: number }>(
    `SELECT product_id, SUM(quantity) as received FROM goods_receipt_items WHERE grn_id = ?1 GROUP BY product_id`,
    [grnId],
  )
  const expected = Object.fromEntries(griSums.map((r) => [r.product_id, r.received]))
  for (const b of batchRows) {
    if (b.quantity < (expected[b.product_id] ?? 0)) {
      throw new Error(
        `Cannot reverse — batch ${b.id} for product ${b.product_id} has been partially sold/transferred. Use a stock adjustment instead.`,
      )
    }
  }

  // Delete batches + stock movements
  for (const b of batchRows) {
    await execute(`DELETE FROM stock_movements WHERE batch_id = ?1`, [b.id])
    await execute(`DELETE FROM batches WHERE id = ?1`, [b.id])
  }

  // Reset received_quantity on PO line items
  if (grn.po_id) {
    const griItems = await query<{ po_item_id: string | null; quantity: number }>(
      `SELECT po_item_id, quantity FROM goods_receipt_items WHERE grn_id = ?1`,
      [grnId],
    )
    for (const it of griItems) {
      if (it.po_item_id) {
        await execute(
          `UPDATE purchase_order_items SET received_quantity = MAX(0, received_quantity - ?1) WHERE id = ?2`,
          [it.quantity, it.po_item_id],
        )
      }
    }
    // Recompute PO status
    const updated = await getPurchaseOrder(grn.po_id)
    if (updated) {
      const allReceived = updated.items.every((it) => it.received_quantity >= it.quantity)
      const someReceived = updated.items.some((it) => it.received_quantity > 0)
      const newStatus = allReceived ? "received" : someReceived ? "partial" : "sent"
      await updatePOStatus(grn.po_id, newStatus)
    }
  }

  // Decrement supplier balance owed
  await execute(`UPDATE suppliers SET balance_owed = balance_owed - ?1 WHERE id = ?2`, [
    grn.total,
    grn.supplier_id,
  ])

  // Stamp reversal on the GRN row (audit trail)
  await execute(
    `UPDATE goods_receipts SET reversed_at = datetime('now'), reversed_by = ?1 WHERE id = ?2`,
    [userId, grnId],
  )
}

// ─── Three-way match ──────────────────────────────────────────────

export interface ThreeWayMatchResult {
  ok: boolean
  poTotal: number
  grnTotal: number
  invoiceTotal: number | null
  /** Largest pair-wise variance as a percentage of the PO total. */
  maxVariancePct: number
  tolerancePct: number
  /** Human-readable summary. */
  summary: string
}

/**
 * Compare PO total ↔ GRN total ↔ supplier invoice total.
 *
 * Returns ok=true if all three (or all two if no invoice yet) are
 * within the configured tolerance percent of each other.
 *
 * Use case: gate the "Mark PO as paid" action — refuse if the match
 * fails, force operator to either reverse a GRN, edit the invoice
 * total, or override with a written reason.
 */
export async function threeWayMatch(poId: string): Promise<ThreeWayMatchResult> {
  const cfg = await getApprovalSettings()
  const result = await getPurchaseOrder(poId)
  if (!result) throw new Error("Purchase order not found")

  const poTotal = result.po.total

  const grnRows = await query<{ total: number; invoice_total: number | null }>(
    `SELECT total, invoice_total FROM goods_receipts
     WHERE po_id = ?1 AND reversed_at IS NULL`,
    [poId],
  )
  const grnTotal = grnRows.reduce((s, r) => s + (r.total || 0), 0)
  const invoiceTotals = grnRows.map((r) => r.invoice_total).filter((v): v is number => v != null)
  const invoiceTotal = invoiceTotals.length > 0 ? invoiceTotals.reduce((s, n) => s + n, 0) : null

  const candidates = [poTotal, grnTotal, ...(invoiceTotal != null ? [invoiceTotal] : [])]
  let maxVariancePct = 0
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]
      const b = candidates[j]
      if (a === 0 && b === 0) continue
      const denom = Math.max(Math.abs(a), Math.abs(b))
      const variance = (Math.abs(a - b) / denom) * 100
      if (variance > maxVariancePct) maxVariancePct = variance
    }
  }
  const ok = maxVariancePct <= cfg.toleranceDocPct
  return {
    ok,
    poTotal,
    grnTotal,
    invoiceTotal,
    maxVariancePct,
    tolerancePct: cfg.toleranceDocPct,
    summary: ok
      ? `Matched within ${cfg.toleranceDocPct}% tolerance.`
      : `Variance ${maxVariancePct.toFixed(2)}% exceeds ${cfg.toleranceDocPct}% tolerance.`,
  }
}

// ─── Mixed-currency helpers ───────────────────────────────────────

/**
 * Convert a foreign-currency amount to base using the exchange rate
 * snapshotted on the PO at GRN time. If the PO is in base currency,
 * returns the amount unchanged.
 */
export function toBaseCurrency(amount: number, exchangeRate: number): number {
  return amount * (exchangeRate || 1)
}
