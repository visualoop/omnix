/**
 * Alert scanners — background jobs that inspect the DB and emit notifications.
 *
 * Wired via useAlertScanner in AppContent. Runs:
 *   - 60s after boot (first pass)
 *   - Every 5 minutes thereafter
 *
 * Each scanner is idempotent via dedupe keys so we never spam.
 */
import { query } from "@/lib/db";
import { emit } from "@/services/notifications";

const NEAR_EXPIRY_DAYS = 30;
const LOW_STOCK_MARGIN = 1.0; // trigger at exactly reorder_level

interface ExpiryRow { batch_id: string; sku: string; product_name: string; expiry_date: string; days_left: number; }

async function scanExpiring(): Promise<void> {
  const rows = await query<ExpiryRow>(
    `SELECT b.id AS batch_id, p.sku, p.name AS product_name, b.expiry_date,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_left
     FROM batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.expiry_date IS NOT NULL
       AND b.quantity > 0
       AND julianday(b.expiry_date) - julianday('now') BETWEEN 0 AND ?1
     ORDER BY b.expiry_date ASC
     LIMIT 50`,
    [NEAR_EXPIRY_DAYS],
  );
  for (const r of rows) {
    await emit({
      kind: "expiry",
      severity: r.days_left < 7 ? "critical" : "warning",
      title: `${r.product_name} expires in ${r.days_left} day${r.days_left === 1 ? "" : "s"}`,
      body: `Batch on shelf. Consider discount or write-off before ${new Date(r.expiry_date).toLocaleDateString()}.`,
      link: "/pharmacy/expiry",
      dedupeKey: `expiry:${r.batch_id}`,
      metadata: { batch_id: r.batch_id, sku: r.sku },
    });
  }
}

interface LowStockRow { product_id: string; sku: string; name: string; qty: number; reorder_level: number; }

async function scanLowStock(): Promise<void> {
  const rows = await query<LowStockRow>(
    `SELECT p.id AS product_id, p.sku, p.name, p.reorder_level,
            COALESCE(SUM(b.quantity), 0) AS qty
     FROM products p
     LEFT JOIN batches b ON b.product_id = p.id
     WHERE p.deleted_at IS NULL
       AND p.reorder_level IS NOT NULL
       AND p.reorder_level > 0
     GROUP BY p.id
     HAVING qty <= p.reorder_level * ?1
     ORDER BY (qty * 1.0 / p.reorder_level) ASC
     LIMIT 50`,
    [LOW_STOCK_MARGIN],
  );
  for (const r of rows) {
    await emit({
      kind: "low_stock",
      severity: r.qty === 0 ? "critical" : "warning",
      title: r.qty === 0 ? `${r.name} — out of stock` : `${r.name} — running low (${r.qty} left)`,
      body: `Reorder level is ${r.reorder_level}. Consider creating a purchase order.`,
      link: "/inventory",
      dedupeKey: `low_stock:${r.product_id}`,
      metadata: { product_id: r.product_id, sku: r.sku, qty: r.qty, reorder_level: r.reorder_level },
    });
  }
}

interface UnpaidInvoiceRow { id: string; invoice_number: string; customer_name: string; total: number; days_overdue: number; }

async function scanUnpaidInvoices(): Promise<void> {
  const rows = await query<UnpaidInvoiceRow>(
    `SELECT i.id, i.invoice_number, i.customer_name,
            (i.total_amount - i.paid_amount) AS total,
            CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue
     FROM invoices i
     WHERE i.status IN ('sent', 'partial')
       AND i.due_date < date('now')
       AND (i.total_amount - i.paid_amount) > 0
     ORDER BY i.due_date ASC
     LIMIT 20`,
  );
  for (const r of rows) {
    await emit({
      kind: "unpaid_invoice",
      severity: r.days_overdue > 30 ? "critical" : "warning",
      title: `Invoice ${r.invoice_number} is ${r.days_overdue} day${r.days_overdue === 1 ? "" : "s"} overdue`,
      body: `${r.customer_name} — outstanding ${r.total.toLocaleString()}. Consider a follow-up call.`,
      link: `/invoicing/invoice/${r.id}`,
      dedupeKey: `unpaid_invoice:${r.id}`,
      metadata: { invoice_id: r.id, amount: r.total },
    });
  }
}

interface RefillRow { id: string; patient_name: string; drug_name: string; refill_date: string; }

async function scanRefillsDue(): Promise<void> {
  // Only run if the pharmacy table exists (installer may lack it).
  const check = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='refills'`,
  ).catch(() => [{ n: 0 }]);
  if ((check[0]?.n ?? 0) === 0) return;

  const rows = await query<RefillRow>(
    `SELECT r.id, r.patient_name, r.drug_name, r.refill_date
     FROM refills r
     WHERE r.status = 'pending'
       AND r.refill_date <= date('now', '+3 days')
     ORDER BY r.refill_date ASC
     LIMIT 30`,
  ).catch(() => []);
  for (const r of rows) {
    await emit({
      kind: "refill_due",
      severity: "info",
      title: `Refill due: ${r.drug_name}`,
      body: `${r.patient_name} — ${new Date(r.refill_date).toLocaleDateString()}. Send a WhatsApp reminder?`,
      link: "/pharmacy/refills",
      dedupeKey: `refill_due:${r.id}`,
    });
  }
}

/**
 * Run all scanners. Errors in one don't block others.
 */
export async function runAllScanners(): Promise<void> {
  await Promise.allSettled([
    scanExpiring(),
    scanLowStock(),
    scanUnpaidInvoices(),
    scanRefillsDue(),
  ]);
}
