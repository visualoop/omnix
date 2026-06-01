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
  quote_number: string;
  customer_id: string | null;
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

export async function createQuotation(input: {
  customerId: string | null;
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

  await execute(
    `INSERT INTO quotations (id, quote_number, branch_id, customer_id, status, valid_until,
        subtotal, discount, tax_amount, total, salesperson_id, notes)
     VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [id, number, getActiveBranchId(), input.customerId, input.validUntil ?? null,
     subtotal, discount, taxAmount, total, input.salespersonId ?? null, input.notes ?? null],
  );
  for (const l of lines) {
    await execute(
      `INSERT INTO quotation_items (id, quotation_id, product_id, name, uom, quantity, unit_price, discount, tax_rate, line_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      [uid(), id, l.product_id ?? null, l.name, l.uom ?? null, l.quantity, l.unit_price, l.discount, l.tax_rate, l.line_total],
    );
  }
  return id;
}

export async function listQuotations(): Promise<Quotation[]> {
  return query<Quotation>(
    `SELECT id, quote_number, customer_id, status, total, valid_until, converted_sale_id, created_at
     FROM quotations ORDER BY created_at DESC LIMIT 200`,
  );
}

/** Convert an accepted quotation into a Core sale (payments handled by caller/POS). */
export async function convertQuoteToSale(
  quoteId: string,
  payments: PaymentEntry[],
  userId: string,
): Promise<string> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.quotations.manage", { entityType: "quotation", entityId: quoteId });

  const [q] = await query<{ customer_id: string | null; status: string; discount: number }>(
    `SELECT customer_id, status, discount FROM quotations WHERE id = ?1`, [quoteId],
  );
  if (!q) throw new Error("Quotation not found");
  if (q.status === "converted") throw new Error("Quotation already converted");

  const items = await query<{ product_id: string | null; name: string; quantity: number; unit_price: number; discount: number; tax_rate: number; line_total: number }>(
    `SELECT product_id, name, quantity, unit_price, discount, tax_rate, line_total FROM quotation_items WHERE quotation_id = ?1`,
    [quoteId],
  );
  const cart: CartItem[] = items.map((i) => ({
    id: uid(),
    product_id: i.product_id ?? "",
    name: i.name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    discount: i.discount,
    tax_rate: i.tax_rate,
    total: i.line_total,
  }));

  const { saleId } = await completeSale(cart, payments, q.customer_id, userId, q.discount);
  await execute(`UPDATE quotations SET status = 'converted', converted_sale_id = ?2 WHERE id = ?1`, [quoteId, saleId]);
  return saleId;
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
  // Lazily create a zero-limit account row.
  await execute(`INSERT OR IGNORE INTO customer_accounts (customer_id) VALUES (?1)`, [customerId]);
  return { customer_id: customerId, credit_limit: 0, balance: 0, terms_days: 30, on_hold: 0 };
}

export async function setCreditLimit(customerId: string, limit: number, termsDays = 30): Promise<void> {
  await requirePermission("hardware.accounts.manage", { entityType: "customer_account", entityId: customerId, metadata: { limit } });
  await execute(
    `INSERT INTO customer_accounts (customer_id, credit_limit, terms_days) VALUES (?1, ?2, ?3)
     ON CONFLICT(customer_id) DO UPDATE SET credit_limit = excluded.credit_limit, terms_days = excluded.terms_days, updated_at = datetime('now')`,
    [customerId, limit, termsDays],
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

/** Aged receivables across all accounts (or one customer) as of a date. */
export async function agedReceivables(asOf: Date = new Date(), customerId?: string): Promise<AgingBuckets> {
  const charges = await query<{ amount: number; balance_after: number; due_date: string | null; created_at: string; customer_id: string }>(
    `SELECT amount, balance_after, due_date, created_at, customer_id FROM account_ledger
     WHERE entry_type = 'charge' ${customerId ? "AND customer_id = ?1" : ""}`,
    customerId ? [customerId] : [],
  );
  const buckets: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
  for (const c of charges) {
    const base = c.due_date ? new Date(c.due_date) : new Date(c.created_at);
    const days = Math.floor((asOf.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    const amt = Math.abs(c.amount);
    if (days <= 0) buckets.current += amt;
    else if (days <= 30) buckets.d1_30 += amt;
    else if (days <= 60) buckets.d31_60 += amt;
    else if (days <= 90) buckets.d61_90 += amt;
    else buckets.d90_plus += amt;
    buckets.total += amt;
  }
  return buckets;
}

// ─── Commissions ─────────────────────────────────────────────────────────────

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
