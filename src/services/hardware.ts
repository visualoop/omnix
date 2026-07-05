/**
 * Hardware module service (plan 10).
 *
 * Quotations (→ convert to Core sale), delivery notes, contractor accounts with
 * credit limits + aged receivables, and salesperson commissions. Every mutating
 * op asserts the hardware entitlement and the relevant permission.
 *
 * Pricing reuses the Retail engine (resolvePrice) — contractor/wholesale price
 * lists are ordinary price lists assigned to a customer.
 */
import { query, execute } from "@/lib/db";
import { assertModuleEntitled } from "@/services/license";
import { requirePermission } from "@/services/rbac";
import { completeSale, type CartItem, type PaymentEntry } from "@/services/sales";
import { getActiveBranchId } from "@/stores/active-branch";

const uid = () => crypto.randomUUID();

// ─── Quotations ──────────────────────────────────────────────────────────────

export interface QuoteItemInput {
  product_id?: string;
  name: string;
  uom?: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  total: number;
  valid_until: string | null;
  converted_sale_id: string | null;
  created_at: string;
}

async function nextNumber(table: string, prefix: string): Promise<string> {
  const [row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return `${prefix}-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
}

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export async function createQuotation(input: {
  customerId: string | null;
  userId: string;
  salespersonId?: string | null;
  validUntil?: string | null;
  items: QuoteItemInput[];
  notes?: string;
}): Promise<string> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.quotations.manage", { entityType: "quotation" });

  const id = uid();
  const number = await nextNumber("quotations", "QT");
  const lines = input.items.map((i) => ({
    ...i,
    discount: i.discount ?? 0,
    tax_rate: i.tax_rate ?? 0,
    line_total: Math.max(0, i.unit_price * i.quantity - (i.discount ?? 0)),
  }));
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);
  const taxAmount = lines.reduce((s, l) => s + (l.unit_price * l.quantity - l.discount) * (l.tax_rate / 100), 0);
  const total = subtotal - discount + taxAmount;
  const validUntil = input.validUntil ?? defaultValidUntil();

  // Populate customer contact fields from the customers row so the
  // quote PDF + detail view has phone/email/address without a JOIN.
  let customerName = "Walk-in customer";
  let customerPhone: string | null = null;
  let customerEmail: string | null = null;
  let customerAddress: string | null = null;
  if (input.customerId) {
    const [c] = await query<{ name: string; phone: string | null; email: string | null; address: string | null }>(
      `SELECT name, phone, email, address FROM customers WHERE id = ?1`,
      [input.customerId],
    );
    if (c) {
      customerName = c.name;
      customerPhone = c.phone ?? null;
      customerEmail = c.email ?? null;
      customerAddress = c.address ?? null;
    }
  }

  // branch_id has an FK to branches(id). getActiveBranchId() falls back to
  // 'default-branch'; if that row is missing (or the active id is stale) the
  // insert would fail with a raw FK error. Resolve to a real branch or NULL.
  let branchId: string | null = getActiveBranchId();
  const branchRows = await query<{ id: string }>(`SELECT id FROM branches WHERE id = ?1`, [branchId]);
  if (!branchRows[0]) {
    const [anyBranch] = await query<{ id: string }>(`SELECT id FROM branches WHERE active = 1 ORDER BY is_default DESC LIMIT 1`);
    branchId = anyBranch?.id ?? null;
  }

  try {
    await execute(
      `INSERT INTO quotations
         (id, quotation_number, branch_id, customer_id, customer_name, customer_phone, customer_email, customer_address, status, valid_until,
          subtotal, discount_amount, tax_amount, total, salesperson_id, notes, user_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
      [
        id, number, branchId, input.customerId, customerName,
        customerPhone, customerEmail, customerAddress, validUntil,
        subtotal, discount, taxAmount, total, input.salespersonId ?? null,
        input.notes ?? null, input.userId,
      ],
    );
  } catch (e) {
    // Tauri SQL errors reject with a raw string, not an Error — wrap it so
    // the UI surfaces the actual cause instead of a generic message.
    throw new Error(`Could not save quote header: ${e instanceof Error ? e.message : String(e)}`);
  }
  let sortOrder = 0;
  try {
    for (const l of lines) {
      await execute(
        `INSERT INTO quotation_items
           (id, quotation_id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
        [
          uid(), id, l.product_id ?? null, l.name || "Item", l.quantity,
          l.uom ?? "pcs", l.unit_price, l.tax_rate, l.discount, l.line_total, sortOrder++,
        ],
      );
    }
  } catch (e) {
    // Roll back the orphaned header so a retry doesn't collide, then surface.
    await execute(`DELETE FROM quotations WHERE id = ?1`, [id]).catch(() => {});
    throw new Error(`Could not save quote lines: ${e instanceof Error ? e.message : String(e)}`);
  }
  return id;
}

export async function listQuotations(): Promise<Quotation[]> {
  return query<Quotation>(
    `SELECT id, quotation_number, customer_id, customer_name, status, total,
            valid_until, converted_sale_id, created_at
     FROM quotations ORDER BY created_at DESC LIMIT 200`,
  );
}

/** Duplicate a quotation into a fresh draft revision. Copies every
 *  line item; the original stays as-is. The new row's status is
 *  'draft' so it can be edited via POS or amended before sending.
 *  Amend workflow (HW-19). */
export async function duplicateQuotation(originalId: string): Promise<string> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.quotations.manage", { entityType: "quotation" });
  const [orig] = await query<{ customer_id: string | null; salesperson_id: string | null; valid_until: string | null; notes: string | null; user_id: string; discount_amount: number; subtotal: number; tax_amount: number; total: number }>(
    `SELECT customer_id, salesperson_id, valid_until, notes, user_id, discount_amount, subtotal, tax_amount, total
     FROM quotations WHERE id = ?1`,
    [originalId],
  );
  if (!orig) throw new Error("Quotation not found");

  const items = await query<{ product_id: string | null; description: string; quantity: number; unit: string | null; unit_price: number; tax_rate: number; discount_amount: number; line_total: number; sort_order: number }>(
    `SELECT product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total, sort_order
     FROM quotation_items WHERE quotation_id = ?1 ORDER BY sort_order`,
    [originalId],
  );

  const newId = uid();
  const number = await nextNumber("quotations", "QT");
  await execute(
    `INSERT INTO quotations
       (id, quotation_number, branch_id, customer_id, customer_name, status, valid_until,
        subtotal, discount_amount, tax_amount, total, salesperson_id, notes, user_id)
     SELECT ?1, ?2, branch_id, customer_id, customer_name, 'draft', valid_until,
        subtotal, discount_amount, tax_amount, total, salesperson_id,
        'Amended from ' || quotation_number || '\n\n' || COALESCE(notes, ''),
        user_id
     FROM quotations WHERE id = ?3`,
    [newId, number, originalId],
  );
  for (const it of items) {
    await execute(
      `INSERT INTO quotation_items (id, quotation_id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      [uid(), newId, it.product_id, it.description, it.quantity, it.unit ?? "pcs", it.unit_price, it.tax_rate, it.discount_amount, it.line_total, it.sort_order],
    );
  }
  return newId;
}

/** Convert an accepted quotation into a Core sale (payments handled by caller/POS). */
export async function convertQuoteToSale(
  quoteId: string,
  payments: PaymentEntry[],
  userId: string,
): Promise<string> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.quotations.manage", { entityType: "quotation", entityId: quoteId });

  const [q] = await query<{ customer_id: string | null; status: string; discount_amount: number }>(
    `SELECT customer_id, status, discount_amount FROM quotations WHERE id = ?1`, [quoteId],
  );
  if (!q) throw new Error("Quotation not found");
  if (q.status === "converted") throw new Error("Quotation already converted");

  const items = await query<{ product_id: string | null; description: string; quantity: number; unit_price: number; discount_amount: number; tax_rate: number; line_total: number }>(
    `SELECT product_id, description, quantity, unit_price, discount_amount, tax_rate, line_total
       FROM quotation_items WHERE quotation_id = ?1`,
    [quoteId],
  );
  const cart: CartItem[] = items.map((i) => ({
    id: uid(),
    product_id: i.product_id ?? "",
    name: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    discount: i.discount_amount,
    tax_rate: i.tax_rate,
    total: i.line_total,
  }));

  const { saleId } = await completeSale(cart, payments, q.customer_id, userId, q.discount_amount);
  await execute(`UPDATE quotations SET status = 'converted', converted_sale_id = ?2 WHERE id = ?1`, [quoteId, saleId]);
  return saleId;
}

/**
 * Hardware → POS bridge. Returns the cart payload + a customer label so the
 * caller can `loadSnapshot()` it and route the cashier to /pos. Payment is
 * collected through the standard POS flow (cash, M-Pesa, customer credit).
 */
export interface HardwareCheckoutPayload {
  quote: { id: string; quotation_number: string; customer_id: string | null; customer_name: string | null; discount: number };
  items: CartItem[];
}

export async function prepareQuoteForPosCheckout(quoteId: string): Promise<HardwareCheckoutPayload> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.quotations.manage", { entityType: "quotation", entityId: quoteId });

  const [q] = await query<{ id: string; quotation_number: string; customer_id: string | null; customer_name: string | null; status: string; discount_amount: number }>(
    `SELECT q.id, q.quotation_number, q.customer_id, q.customer_name, q.status, q.discount_amount
       FROM quotations q
      WHERE q.id = ?1`,
    [quoteId],
  );
  if (!q) throw new Error("Quotation not found");
  if (q.status === "converted") throw new Error("Quotation already converted");
  if (q.status === "cancelled" || q.status === "expired") throw new Error(`Cannot check out a ${q.status} quote`);

  const items = await query<{ product_id: string | null; description: string; quantity: number; unit_price: number; discount_amount: number; tax_rate: number; line_total: number }>(
    `SELECT product_id, description, quantity, unit_price, discount_amount, tax_rate, line_total
       FROM quotation_items WHERE quotation_id = ?1`,
    [quoteId],
  );
  if (items.length === 0) throw new Error("No items on this quote");

  const cart: CartItem[] = items.map((i) => ({
    id: uid(),
    product_id: i.product_id ?? "",
    name: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    discount: i.discount_amount,
    tax_rate: i.tax_rate,
    total: i.line_total,
  }));

  return {
    quote: {
      id: q.id,
      quotation_number: q.quotation_number,
      customer_id: q.customer_id,
      customer_name: q.customer_name,
      discount: q.discount_amount,
    },
    items: cart,
  };
}

/** Called by POS payment flow to close out the quote once the sale is paid. */
export async function markQuotePaidFromPos(quoteId: string, saleId: string): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.quotations.manage", { entityType: "quotation", entityId: quoteId });
  await execute(
    `UPDATE quotations SET status = 'converted', converted_sale_id = ?2 WHERE id = ?1`,
    [quoteId, saleId],
  );
}

// ─── Delivery notes ──────────────────────────────────────────────────────────

export async function createDeliveryNote(input: {
  customerId: string | null;
  saleId?: string | null;
  address?: string;
  items: Array<{ product_id?: string; name: string; uom?: string; quantity: number }>;
}): Promise<string> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.delivery_notes.manage", { entityType: "delivery_note" });
  const id = uid();
  const number = await nextNumber("delivery_notes", "DN");
  await execute(
    `INSERT INTO delivery_notes (id, note_number, branch_id, customer_id, sale_id, status, delivery_address)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)`,
    [id, number, getActiveBranchId(), input.customerId, input.saleId ?? null, input.address ?? null],
  );
  for (const it of input.items) {
    await execute(
      `INSERT INTO delivery_note_items (id, delivery_note_id, product_id, name, uom, quantity)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [uid(), id, it.product_id ?? null, it.name, it.uom ?? null, it.quantity],
    );
  }
  return id;
}

export async function markDispatched(noteId: string, vehicle?: string, driver?: string): Promise<void> {
  await requirePermission("hardware.delivery_notes.manage", { entityType: "delivery_note", entityId: noteId });
  await execute(
    `UPDATE delivery_notes SET status = 'dispatched', vehicle = ?2, driver = ?3, dispatched_at = datetime('now')
     WHERE id = ?1 AND status = 'pending'`,
    [noteId, vehicle ?? null, driver ?? null],
  );
}

export async function markDelivered(noteId: string): Promise<void> {
  await requirePermission("hardware.delivery_notes.manage", { entityType: "delivery_note", entityId: noteId });
  await execute(
    `UPDATE delivery_notes SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?1 AND status = 'dispatched'`,
    [noteId],
  );
}

// ─── Contractor accounts: credit + aging ─────────────────────────────────────

export interface CustomerAccount {
  customer_id: string;
  credit_limit: number;
  balance: number;
  terms_days: number;
  on_hold: number;
}

export async function getAccount(customerId: string): Promise<CustomerAccount> {
  const rows = await query<CustomerAccount>(`SELECT * FROM customer_accounts WHERE customer_id = ?1`, [customerId]);
  if (rows[0]) return rows[0];
  // Read the hardware.default_terms_days setting so new accounts inherit
  // the store's preferred terms instead of a hardcoded 30.
  const [tset] = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'hardware.default_terms_days' LIMIT 1`,
  );
  const terms = Math.max(1, parseInt(tset?.value ?? "30", 10) || 30);
  // Lazily create a zero-limit account row with the resolved terms.
  await execute(
    `INSERT OR IGNORE INTO customer_accounts (customer_id, terms_days) VALUES (?1, ?2)`,
    [customerId, terms],
  );
  return { customer_id: customerId, credit_limit: 0, balance: 0, terms_days: terms, on_hold: 0 };
}

export async function setCreditLimit(customerId: string, limit: number, termsDays = 30): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "customer_account", entityId: customerId, metadata: { limit } });
  await execute(
    `INSERT INTO customer_accounts (customer_id, credit_limit, terms_days) VALUES (?1, ?2, ?3)
     ON CONFLICT(customer_id) DO UPDATE SET credit_limit = excluded.credit_limit, terms_days = excluded.terms_days, updated_at = datetime('now')`,
    [customerId, limit, termsDays],
  );
}

/** Toggle the on_hold flag for a contractor account. When on, no new
 *  on-account charges accepted — used when a contractor is past due
 *  or when payment terms are being renegotiated. */
export async function setAccountHold(customerId: string, onHold: boolean): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "customer_account", entityId: customerId, metadata: { onHold } });
  await execute(
    `INSERT INTO customer_accounts (customer_id, on_hold) VALUES (?1, ?2)
     ON CONFLICT(customer_id) DO UPDATE SET on_hold = excluded.on_hold, updated_at = datetime('now')`,
    [customerId, onHold ? 1 : 0],
  );
}

/** Post an adjustment to a customer's ledger. Positive = increase
 *  balance (write-up), negative = decrease (write-off / credit note). */
export async function postAdjustment(customerId: string, amount: number, reason: string, userId?: string): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "customer_account", entityId: customerId, metadata: { adjustment: amount, reason } });
  await postLedger(customerId, "adjustment", amount, { reference: reason, userId });
}

/** All ledger entries for a customer, newest first. Powers the
 *  contractor detail page ledger table. */
export interface LedgerEntry {
  id: string;
  entry_type: "charge" | "payment" | "adjustment";
  amount: number;
  balance_after: number;
  due_date: string | null;
  reference: string | null;
  sale_id: string | null;
  created_at: string;
}
export async function listLedgerEntries(customerId: string, limit = 200): Promise<LedgerEntry[]> {
  return query<LedgerEntry>(
    `SELECT id, entry_type, amount, balance_after, due_date, reference, sale_id, created_at
     FROM account_ledger WHERE customer_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    [customerId, limit],
  );
}


/** Returns true if an on-account charge of `amount` is allowed. */
export async function creditCheck(customerId: string, amount: number): Promise<{ ok: boolean; reason?: string }> {
  const acc = await getAccount(customerId);
  if (acc.on_hold) return { ok: false, reason: "Account is on hold" };
  if (acc.balance + amount > acc.credit_limit) {
    return { ok: false, reason: `Over credit limit (KES ${acc.credit_limit.toLocaleString()})` };
  }
  return { ok: true };
}

async function postLedger(
  customerId: string,
  entryType: "charge" | "payment" | "adjustment",
  signedAmount: number,
  opts: { saleId?: string | null; reference?: string; dueDate?: string | null; userId?: string } = {},
): Promise<void> {
  const acc = await getAccount(customerId);
  const balanceAfter = acc.balance + signedAmount;
  await execute(
    `INSERT INTO account_ledger (id, customer_id, entry_type, sale_id, amount, balance_after, due_date, reference, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [uid(), customerId, entryType, opts.saleId ?? null, signedAmount, balanceAfter, opts.dueDate ?? null, opts.reference ?? null, opts.userId ?? null],
  );
  await execute(`UPDATE customer_accounts SET balance = ?2, updated_at = datetime('now') WHERE customer_id = ?1`, [customerId, balanceAfter]);
}

export async function postCharge(customerId: string, amount: number, opts: { saleId?: string | null; dueDate?: string | null; userId?: string } = {}): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "customer_account", entityId: customerId, metadata: { charge: amount } });
  await postLedger(customerId, "charge", Math.abs(amount), opts);
}

export async function postPayment(customerId: string, amount: number, opts: { reference?: string; userId?: string } = {}): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "customer_account", entityId: customerId, metadata: { payment: amount } });
  await postLedger(customerId, "payment", -Math.abs(amount), opts);
}

export interface AgingBuckets {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
}

/**
 * Aged receivables across all accounts (or one customer) as of a date.
 *
 * Algorithm: FIFO payment application.
 *   1. Load every ledger entry for the customer, oldest first.
 *   2. Charges add to a virtual "outstanding" queue.
 *   3. Payments + adjustments (net negative) consume the queue oldest-first.
 *   4. Whatever charges remain in the queue at end are the true unpaid ones.
 *   5. Bucket each remaining charge by (asOf - due_date OR asOf - created_at).
 *
 * This fixes the pre-v0.45 bug where the report summed ALL charges
 * regardless of whether payments had cleared them. FIFO matches what
 * Kenyan accountants do on paper — oldest debt clears first.
 */
export async function agedReceivables(asOf: Date = new Date(), customerId?: string): Promise<AgingBuckets> {
  const entries = await query<{ entry_type: string; amount: number; due_date: string | null; created_at: string; customer_id: string }>(
    `SELECT entry_type, amount, due_date, created_at, customer_id
     FROM account_ledger
     ${customerId ? "WHERE customer_id = ?1" : ""}
     ORDER BY created_at ASC`,
    customerId ? [customerId] : [],
  );

  // Group by customer so FIFO consumption is per-account.
  const perCustomer = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = perCustomer.get(e.customer_id) ?? [];
    list.push(e);
    perCustomer.set(e.customer_id, list);
  }

  interface UnpaidCharge { amount: number; due: Date }
  const buckets: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };

  for (const [, custEntries] of perCustomer) {
    const unpaid: UnpaidCharge[] = [];
    for (const e of custEntries) {
      if (e.entry_type === "charge") {
        unpaid.push({
          amount: Math.abs(e.amount),
          due: e.due_date ? new Date(e.due_date) : new Date(e.created_at),
        });
      } else {
        // payment or adjustment reducing balance — consume unpaid FIFO.
        let toApply = Math.abs(e.amount);
        while (toApply > 0 && unpaid.length > 0) {
          const head = unpaid[0];
          if (head.amount <= toApply) {
            toApply -= head.amount;
            unpaid.shift();
          } else {
            head.amount -= toApply;
            toApply = 0;
          }
        }
      }
    }
    // Bucket remaining unpaid charges.
    for (const u of unpaid) {
      const days = Math.floor((asOf.getTime() - u.due.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) buckets.current += u.amount;
      else if (days <= 30) buckets.d1_30 += u.amount;
      else if (days <= 60) buckets.d31_60 += u.amount;
      else if (days <= 90) buckets.d61_90 += u.amount;
      else buckets.d90_plus += u.amount;
      buckets.total += u.amount;
    }
  }
  return buckets;
}

/** Which customers have charges in a given bucket — powers the
 *  aging widget drill-through (HW-28). */
export interface AgingCustomerRow {
  customer_id: string;
  name: string;
  outstanding: number;
}
export async function customersInAgingBucket(bucket: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus"): Promise<AgingCustomerRow[]> {
  const [minDays, maxDays] = ({
    current: [Number.NEGATIVE_INFINITY, 0],
    d1_30: [1, 30],
    d31_60: [31, 60],
    d61_90: [61, 90],
    d90_plus: [91, Number.POSITIVE_INFINITY],
  } as const)[bucket];

  // Reuse the same FIFO algorithm to compute per-customer breakdown.
  const entries = await query<{ entry_type: string; amount: number; due_date: string | null; created_at: string; customer_id: string; customer_name: string }>(
    `SELECT al.entry_type, al.amount, al.due_date, al.created_at, al.customer_id, c.name AS customer_name
     FROM account_ledger al
     JOIN customers c ON c.id = al.customer_id
     ORDER BY al.customer_id, al.created_at ASC`,
  );

  const perCustomer = new Map<string, { name: string; entries: typeof entries }>();
  for (const e of entries) {
    const g = perCustomer.get(e.customer_id) ?? { name: e.customer_name, entries: [] };
    g.entries.push(e);
    perCustomer.set(e.customer_id, g);
  }

  const now = Date.now();
  const rows: AgingCustomerRow[] = [];
  for (const [customerId, { name, entries: custEntries }] of perCustomer) {
    interface U { amount: number; due: Date }
    const unpaid: U[] = [];
    for (const e of custEntries) {
      if (e.entry_type === "charge") {
        unpaid.push({ amount: Math.abs(e.amount), due: e.due_date ? new Date(e.due_date) : new Date(e.created_at) });
      } else {
        let toApply = Math.abs(e.amount);
        while (toApply > 0 && unpaid.length > 0) {
          const head = unpaid[0];
          if (head.amount <= toApply) { toApply -= head.amount; unpaid.shift(); }
          else { head.amount -= toApply; toApply = 0; }
        }
      }
    }
    let outstanding = 0;
    for (const u of unpaid) {
      const days = Math.floor((now - u.due.getTime()) / (1000 * 60 * 60 * 24));
      if (days >= minDays && days <= maxDays) outstanding += u.amount;
    }
    if (outstanding > 0) rows.push({ customer_id: customerId, name, outstanding });
  }
  return rows.sort((a, b) => b.outstanding - a.outstanding);
}

/** Silently flip past-due quotes to 'expired'. Idempotent — safe to
 *  call on every hub mount. */
export async function autoExpireQuotes(): Promise<number> {
  const result = await execute(
    `UPDATE quotations SET status = 'expired'
     WHERE status IN ('sent', 'accepted')
       AND valid_until IS NOT NULL
       AND date(valid_until) < date('now')`,
  );
  return (result as unknown as { rowsAffected?: number }).rowsAffected ?? 0;
}

// ─── Commissions ─────────────────────────────────────────────────────────────

export interface CommissionRule {
  id: string;
  employee_id: string;
  employee_name?: string;
  category_id: string | null;
  category_name?: string;
  percent: number;
  active: number;
}

/** All active commission rules with employee names for display. */
export async function listCommissionRules(): Promise<CommissionRule[]> {
  return query<CommissionRule>(
    `SELECT cr.id, cr.employee_id, e.full_name AS employee_name,
            cr.category_id, c.name AS category_name,
            cr.percent, cr.active
     FROM commission_rules cr
     JOIN employees e ON e.id = cr.employee_id
     LEFT JOIN categories c ON c.id = cr.category_id
     WHERE cr.active = 1
     ORDER BY e.full_name`,
  );
}

/** Upsert a commission rule. When ruleId is undefined, inserts new. */
export async function upsertCommissionRule(input: {
  id?: string;
  employeeId: string;
  categoryId?: string | null;
  percent: number;
}): Promise<string> {
  await requirePermission("hardware.accounts.manage", { entityType: "commission_rule", metadata: { employeeId: input.employeeId } });
  const id = input.id ?? uid();
  await execute(
    `INSERT INTO commission_rules (id, employee_id, category_id, percent, active)
     VALUES (?1, ?2, ?3, ?4, 1)
     ON CONFLICT(id) DO UPDATE SET
       employee_id = excluded.employee_id,
       category_id = excluded.category_id,
       percent = excluded.percent`,
    [id, input.employeeId, input.categoryId ?? null, input.percent],
  );
  return id;
}

/** Soft-delete a commission rule (active=0). */
export async function deleteCommissionRule(ruleId: string): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "commission_rule", entityId: ruleId });
  await execute(`UPDATE commission_rules SET active = 0 WHERE id = ?1`, [ruleId]);
}

/** Accrue commission for a sale based on the salesperson's active rule. */
export async function commissionForSale(saleId: string, employeeId: string, baseAmount: number): Promise<number> {
  const [rule] = await query<{ percent: number }>(
    `SELECT percent FROM commission_rules WHERE employee_id = ?1 AND active = 1 AND category_id IS NULL LIMIT 1`,
    [employeeId],
  );
  const percent = rule?.percent ?? 0;
  if (percent <= 0) return 0;
  const amount = baseAmount * (percent / 100);
  await execute(
    `INSERT INTO commission_accruals (id, employee_id, sale_id, base_amount, percent, amount)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [uid(), employeeId, saleId, baseAmount, percent, amount],
  );
  return amount;
}
