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
       AND COALESCE(p.is_service, 0) = 0
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

interface RefillRow { id: string; patient_name: string; drug_summary: string; due_on: string; }

async function tableExists(name: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?1`,
    [name],
  ).catch(() => [{ n: 0 }]);
  return (rows[0]?.n ?? 0) > 0;
}

async function scanRefillsDue(): Promise<void> {
  // Refills are tracked in prescriptions/refill_reminders — there is no
  // `refills` table (the old query silently no-op'd). Read the pending
  // refill_reminders the daily job stages.
  if (!(await tableExists("refill_reminders"))) return;
  const rows = await query<RefillRow>(
    `SELECT id, patient_name, drug_summary, due_on
     FROM refill_reminders
     WHERE sent_at IS NULL AND date(due_on) <= date('now', '+3 days')
     ORDER BY due_on ASC
     LIMIT 30`,
  ).catch(() => []);
  for (const r of rows) {
    await emit({
      kind: "refill_due",
      severity: "info",
      title: `Refill due: ${r.drug_summary}`,
      body: `${r.patient_name} — due ${new Date(r.due_on).toLocaleDateString()}. Send a reminder?`,
      link: "/pharmacy/refills",
      dedupeKey: `refill_due:${r.id}`,
    });
  }
}

interface LicenseRow { id: string; license_type: string; license_number: string; expires_at: string; days_left: number; }

async function scanLicenseExpiry(): Promise<void> {
  // Pharmacy premises + practising licences lapsing → PPB inspection risk.
  if (!(await tableExists("pharmacy_licenses"))) return;
  const rows = await query<LicenseRow>(
    `SELECT id, license_type, license_number, expires_at,
            CAST(julianday(expires_at) - julianday('now') AS INTEGER) AS days_left
     FROM pharmacy_licenses
     WHERE status != 'renewed'
       AND julianday(expires_at) - julianday('now') <= 60
     ORDER BY expires_at ASC
     LIMIT 20`,
  ).catch(() => []);
  for (const r of rows) {
    const expired = r.days_left < 0;
    await emit({
      kind: "license_expiry",
      severity: expired || r.days_left <= 14 ? "critical" : "warning",
      title: expired
        ? `${labelForLicense(r.license_type)} EXPIRED`
        : `${labelForLicense(r.license_type)} expires in ${r.days_left} day${r.days_left === 1 ? "" : "s"}`,
      body: `Licence ${r.license_number}. Renew before ${new Date(r.expires_at).toLocaleDateString()} to avoid a PPB compliance finding.`,
      link: "/settings/pharmacy-licenses",
      dedupeKey: `license_expiry:${r.id}:${expired ? "expired" : "soon"}`,
      metadata: { license_id: r.id },
    });
  }
}

function labelForLicense(t: string): string {
  const map: Record<string, string> = {
    premises: "Premises registration",
    pharmacist: "Pharmacist practising licence",
    ppb_annual: "PPB annual retention",
    superintendent: "Superintendent attachment",
    controlled_permit: "Controlled-substances permit",
    other: "Licence",
  };
  return map[t] ?? "Licence";
}

interface ColdChainRow { id: string; root_cause: string; peak_temperature_c: number; excursion_start: string; }

async function scanColdChain(): Promise<void> {
  // Unreviewed cold-chain excursions — vaccine/insulin integrity at risk.
  if (!(await tableExists("cold_chain_analyses"))) return;
  const rows = await query<ColdChainRow>(
    `SELECT id, root_cause, peak_temperature_c, excursion_start
     FROM cold_chain_analyses
     WHERE reviewed_at IS NULL
     ORDER BY excursion_start DESC
     LIMIT 20`,
  ).catch(() => []);
  for (const r of rows) {
    await emit({
      kind: "cold_chain",
      severity: "critical",
      title: `Cold-chain excursion — peak ${r.peak_temperature_c.toFixed(1)}°C`,
      body: `Likely cause: ${r.root_cause.replace(/_/g, " ")}. Review + confirm affected stock before dispensing.`,
      link: "/pharmacy/cold-chain",
      dedupeKey: `cold_chain:${r.id}`,
      metadata: { analysis_id: r.id },
    });
  }
}

interface WarrantyRow { id: string; serial_number: string; product_name: string; customer_name: string | null; warranty_expiry: string; days_left: number; }

async function scanWarrantyExpiry(): Promise<void> {
  // Sold equipment whose per-unit warranty is lapsing → proactive service /
  // renewal contact before cover ends.
  if (!(await tableExists("equipment_units"))) return;
  const rows = await query<WarrantyRow>(
    `SELECT u.id, u.serial_number, p.name AS product_name, c.name AS customer_name,
            u.warranty_expiry,
            CAST(julianday(u.warranty_expiry) - julianday('now') AS INTEGER) AS days_left
     FROM equipment_units u
     JOIN products p ON p.id = u.product_id
     LEFT JOIN customers c ON c.id = u.customer_id
     WHERE u.warranty_expiry IS NOT NULL
       AND u.status IN ('sold','in_service','rented')
       AND julianday(u.warranty_expiry) - julianday('now') <= 30
     ORDER BY u.warranty_expiry ASC
     LIMIT 30`,
  ).catch(() => []);
  for (const r of rows) {
    const expired = r.days_left < 0;
    await emit({
      kind: "warranty_expiry",
      severity: expired ? "warning" : r.days_left <= 7 ? "warning" : "info",
      title: expired
        ? `Warranty expired — ${r.product_name} (SN ${r.serial_number})`
        : `Warranty expires in ${r.days_left} day${r.days_left === 1 ? "" : "s"} — ${r.product_name}`,
      body: `Serial ${r.serial_number}${r.customer_name ? ` · ${r.customer_name}` : ""}. Cover ends ${new Date(r.warranty_expiry).toLocaleDateString()}.`,
      link: "/hardware/fleet",
      dedupeKey: `warranty_expiry:${r.id}:${expired ? "expired" : "soon"}`,
      metadata: { unit_id: r.id },
    });
  }
}

interface UpcomingApptRow { id: string; appt_number: string; client_name: string | null; staff_name: string | null; starts_at: string; }

async function scanUpcomingAppointments(): Promise<void> {
  // Salon/spa: remind staff of bookings in the next 24h (in-app; SMS is a
  // separate connectivity-gated feature).
  if (!(await tableExists("salon_appointments"))) return;
  const rows = await query<UpcomingApptRow>(
    `SELECT a.id, a.appt_number, c.name AS client_name, s.display_name AS staff_name, a.starts_at
     FROM salon_appointments a
     LEFT JOIN customers c ON c.id = a.client_id
     LEFT JOIN salon_staff s ON s.id = a.staff_id
     WHERE a.status IN ('booked','confirmed')
       AND a.starts_at >= datetime('now') AND a.starts_at <= datetime('now', '+1 day')
     ORDER BY a.starts_at ASC LIMIT 50`,
  ).catch(() => []);
  for (const r of rows) {
    await emit({
      kind: "appointment_reminder",
      severity: "info",
      title: `Upcoming: ${r.client_name ?? "Walk-in"} at ${new Date(r.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      body: `${r.appt_number}${r.staff_name ? ` · ${r.staff_name}` : ""} · ${new Date(r.starts_at).toLocaleDateString()}`,
      link: "/salon",
      dedupeKey: `appt_reminder:${r.id}`,
      metadata: { appointment_id: r.id },
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
    scanLicenseExpiry(),
    scanColdChain(),
    scanWarrantyExpiry(),
    scanUpcomingAppointments(),
  ]);
}
