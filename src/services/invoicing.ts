/**
 * Invoices and quotations service.
 *
 * Quotations are non-binding offers; invoices are accounts-receivable obligations.
 * Quotations can be converted to invoices.
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
export type QuotationStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "converted";

export interface DocumentItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  line_total: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_tax_pin: string | null;
  sale_id: string | null;
  quotation_id: string | null;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  terms: string | null;
  user_id: string;
  branch_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  issue_date: string;
  valid_until: string;
  status: QuotationStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  converted_to_invoice_id: string | null;
  notes: string | null;
  terms: string | null;
  user_id: string;
  branch_id: string | null;
  created_at: string;
}

// ─── Numbering ─────────────────────────────────────────────────────────
async function nextNumber(table: "invoices" | "quotations", prefix: string): Promise<string> {
  const numCol = table === "invoices" ? "invoice_number" : "quotation_number";
  const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
  const [r] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${table} WHERE ${numCol} LIKE ?1`,
    [`${prefix}-${yyyymm}-%`],
  );
  return `${prefix}-${yyyymm}-${String((r?.count || 0) + 1).padStart(4, "0")}`;
}

// ─── Quotations ────────────────────────────────────────────────────────
export async function listQuotations(opts?: {
  status?: QuotationStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Quotation[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.status) { conditions.push(`status = ?${params.length + 1}`); params.push(opts.status); }
  if (opts?.customerId) { conditions.push(`customer_id = ?${params.length + 1}`); params.push(opts.customerId); }
  if (opts?.startDate) { conditions.push(`issue_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`issue_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Auto-mark expired
  await execute(
    `UPDATE quotations SET status = 'expired'
     WHERE status IN ('draft','sent') AND date('now') > valid_until`,
  );

  return query<Quotation>(
    `SELECT * FROM quotations ${where} ORDER BY issue_date DESC, created_at DESC`,
    params,
  );
}

export async function getQuotation(id: string): Promise<{ quotation: Quotation; items: DocumentItem[] } | null> {
  const [quotation] = await query<Quotation>(`SELECT * FROM quotations WHERE id = ?1`, [id]);
  if (!quotation) return null;
  const items = await query<DocumentItem>(
    `SELECT * FROM quotation_items WHERE quotation_id = ?1 ORDER BY sort_order`,
    [id],
  );
  return { quotation, items };
}

export async function createQuotation(input: {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  valid_until: string;
  notes?: string;
  terms?: string;
  user_id: string;
  items: Array<{
    product_id?: string;
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    tax_rate?: number;
    discount_amount?: number;
  }>;
  discount_amount?: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  const number = await nextNumber("quotations", "QT");

  let subtotal = 0;
  let taxAmount = 0;

  await execute(
    `INSERT INTO quotations (id, quotation_number, customer_id, customer_name, customer_phone, customer_email, customer_address,
       valid_until, status, notes, terms, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9, ?10, ?11, ?12)`,
    [id, number, input.customer_id || null, input.customer_name, input.customer_phone || null, input.customer_email || null,
      input.customer_address || null, input.valid_until, input.notes || null, input.terms || null, input.user_id, getActiveBranchId()],
  );

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const lineSubtotal = item.quantity * item.unit_price - (item.discount_amount || 0);
    const lineTax = lineSubtotal * (item.tax_rate || 0) / 100;
    const lineTotal = lineSubtotal + lineTax;
    subtotal += lineSubtotal;
    taxAmount += lineTax;
    await execute(
      `INSERT INTO quotation_items (id, quotation_id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      [crypto.randomUUID(), id, item.product_id || null, item.description, item.quantity, item.unit || "pcs",
        item.unit_price, item.tax_rate || 0, item.discount_amount || 0, lineTotal, i],
    );
  }

  const headerDiscount = input.discount_amount || 0;
  const total = subtotal + taxAmount - headerDiscount;
  await execute(
    `UPDATE quotations SET subtotal = ?1, discount_amount = ?2, tax_amount = ?3, total = ?4 WHERE id = ?5`,
    [subtotal, headerDiscount, taxAmount, total, id],
  );

  return id;
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  await execute(`UPDATE quotations SET status = ?2 WHERE id = ?1`, [id, status]);
}

/** Convert an accepted quotation to an invoice. */
export async function convertQuotationToInvoice(quotationId: string, dueDate: string, userId: string): Promise<string> {
  const data = await getQuotation(quotationId);
  if (!data) throw new Error("Quotation not found");
  if (data.quotation.status === "converted") throw new Error("Already converted");

  const invoiceId = await createInvoice({
    customer_id: data.quotation.customer_id || undefined,
    customer_name: data.quotation.customer_name,
    customer_phone: data.quotation.customer_phone || undefined,
    customer_email: data.quotation.customer_email || undefined,
    customer_address: data.quotation.customer_address || undefined,
    quotation_id: quotationId,
    due_date: dueDate,
    notes: data.quotation.notes || undefined,
    terms: data.quotation.terms || undefined,
    user_id: userId,
    items: data.items.map((it) => ({
      product_id: it.product_id || undefined,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.unit_price,
      tax_rate: it.tax_rate,
      discount_amount: it.discount_amount,
    })),
    discount_amount: data.quotation.discount_amount,
  });

  await execute(
    `UPDATE quotations SET status = 'converted', converted_to_invoice_id = ?2 WHERE id = ?1`,
    [quotationId, invoiceId],
  );

  return invoiceId;
}

export async function deleteQuotation(id: string): Promise<void> {
  await execute(`DELETE FROM quotation_items WHERE quotation_id = ?1`, [id]);
  await execute(`DELETE FROM quotations WHERE id = ?1`, [id]);
}

// ─── Invoices ──────────────────────────────────────────────────────────
export async function listInvoices(opts?: {
  status?: InvoiceStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<Invoice[]> {
  // Auto-mark overdue
  await execute(
    `UPDATE invoices SET status = 'overdue'
     WHERE status IN ('sent','partial') AND date('now') > due_date AND amount_paid < total`,
  );

  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.status) { conditions.push(`status = ?${params.length + 1}`); params.push(opts.status); }
  if (opts?.customerId) { conditions.push(`customer_id = ?${params.length + 1}`); params.push(opts.customerId); }
  if (opts?.startDate) { conditions.push(`issue_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`issue_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  if (opts?.branchId) { conditions.push(`branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<Invoice>(
    `SELECT * FROM invoices ${where} ORDER BY issue_date DESC, created_at DESC`,
    params,
  );
}

export async function getInvoice(id: string): Promise<{
  invoice: Invoice;
  items: DocumentItem[];
  payments: Array<{
    id: string;
    amount: number;
    payment_method: string;
    reference: string | null;
    payment_date: string;
    notes: string | null;
  }>;
} | null> {
  const [invoice] = await query<Invoice>(`SELECT * FROM invoices WHERE id = ?1`, [id]);
  if (!invoice) return null;
  const items = await query<DocumentItem>(
    `SELECT * FROM invoice_items WHERE invoice_id = ?1 ORDER BY sort_order`,
    [id],
  );
  const payments = await query<any>(
    `SELECT id, amount, payment_method, reference, payment_date, notes
     FROM invoice_payments WHERE invoice_id = ?1 ORDER BY payment_date DESC`,
    [id],
  );
  return { invoice, items, payments };
}

export async function createInvoice(input: {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_tax_pin?: string;
  sale_id?: string;
  quotation_id?: string;
  issue_date?: string;
  due_date: string;
  notes?: string;
  terms?: string;
  user_id: string;
  items: Array<{
    product_id?: string;
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    tax_rate?: number;
    discount_amount?: number;
  }>;
  discount_amount?: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  const number = await nextNumber("invoices", "INV");

  await execute(
    `INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, customer_email, customer_address,
       customer_tax_pin, sale_id, quotation_id, issue_date, due_date, status, notes, terms, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'draft', ?13, ?14, ?15, ?16)`,
    [id, number, input.customer_id || null, input.customer_name, input.customer_phone || null, input.customer_email || null,
      input.customer_address || null, input.customer_tax_pin || null, input.sale_id || null, input.quotation_id || null,
      input.issue_date || new Date().toISOString().slice(0, 10), input.due_date,
      input.notes || null, input.terms || null, input.user_id, getActiveBranchId()],
  );

  let subtotal = 0;
  let taxAmount = 0;
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const lineSubtotal = item.quantity * item.unit_price - (item.discount_amount || 0);
    const lineTax = lineSubtotal * (item.tax_rate || 0) / 100;
    const lineTotal = lineSubtotal + lineTax;
    subtotal += lineSubtotal;
    taxAmount += lineTax;
    await execute(
      `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      [crypto.randomUUID(), id, item.product_id || null, item.description, item.quantity, item.unit || "pcs",
        item.unit_price, item.tax_rate || 0, item.discount_amount || 0, lineTotal, i],
    );
  }

  const headerDiscount = input.discount_amount || 0;
  const total = subtotal + taxAmount - headerDiscount;
  await execute(
    `UPDATE invoices SET subtotal = ?1, discount_amount = ?2, tax_amount = ?3, total = ?4 WHERE id = ?5`,
    [subtotal, headerDiscount, taxAmount, total, id],
  );

  return id;
}

export async function markInvoiceSent(id: string): Promise<void> {
  await execute(
    `UPDATE invoices SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?1 AND status = 'draft'`,
    [id],
  );
}

export async function recordInvoicePayment(input: {
  invoice_id: string;
  amount: number;
  payment_method: string;
  reference?: string;
  payment_date?: string;
  notes?: string;
  user_id: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO invoice_payments (id, invoice_id, amount, payment_method, reference, payment_date, notes, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [id, input.invoice_id, input.amount, input.payment_method, input.reference || null,
      input.payment_date || new Date().toISOString().slice(0, 10), input.notes || null, input.user_id],
  );

  // Update invoice paid amount and status
  const [inv] = await query<{ total: number; amount_paid: number }>(
    `SELECT total, COALESCE(SUM(p.amount), 0) AS amount_paid FROM invoices i
     LEFT JOIN invoice_payments p ON p.invoice_id = i.id
     WHERE i.id = ?1 GROUP BY i.id`,
    [input.invoice_id],
  );

  let newStatus: InvoiceStatus;
  if (inv.amount_paid >= inv.total) newStatus = "paid";
  else if (inv.amount_paid > 0) newStatus = "partial";
  else newStatus = "sent";

  await execute(
    `UPDATE invoices SET amount_paid = ?2, status = ?3, updated_at = datetime('now') WHERE id = ?1`,
    [input.invoice_id, inv.amount_paid, newStatus],
  );

  // Mirror to bank for reconciliation
  try {
    const { recordTransaction } = await import("./banking");
    const [invDetails] = await query<{ customer_name: string; invoice_number: string }>(
      `SELECT customer_name, invoice_number FROM invoices WHERE id = ?1`,
      [input.invoice_id],
    );
    const lower = input.payment_method.toLowerCase();
    let accountType = "cash_box";
    if (lower.includes("mpesa") || lower.includes("m-pesa")) accountType = "mpesa_till";
    else if (lower.includes("bank") || lower.includes("cheque") || lower.includes("transfer") || lower.includes("card")) accountType = "bank";
    const [acc] = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type = ?1 AND is_active = 1 ORDER BY is_default DESC LIMIT 1`,
      [accountType],
    );
    const accountId = acc?.id || (await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE is_active = 1 ORDER BY is_default DESC LIMIT 1`,
    ))[0]?.id;
    if (accountId) {
      await recordTransaction({
        account_id: accountId,
        transaction_type: "deposit",
        amount: input.amount,
        description: `Invoice payment: ${invDetails?.invoice_number || ""}`,
        counterparty_name: invDetails?.customer_name,
        payment_method: input.payment_method,
        reference: input.reference || undefined,
        transaction_date: input.payment_date,
        related_invoice_payment_id: id,
        user_id: input.user_id,
      });
    }
  } catch (e) { console.warn("Bank txn mirror failed:", e); }

  return id;
}

export async function cancelInvoice(id: string): Promise<void> {
  await execute(
    `UPDATE invoices SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?1`,
    [id],
  );
}

// ─── Aged Receivables ──────────────────────────────────────────────────
export interface AgedReceivable {
  customer_id: string | null;
  customer_name: string;
  current: number;       // due 0-30 days
  days_30: number;       // 31-60
  days_60: number;       // 61-90
  days_90: number;       // 90+
  total: number;
}

export async function getAgedReceivables(): Promise<AgedReceivable[]> {
  // For each unpaid invoice, calculate age of debt and bucket
  const rows = await query<{
    customer_id: string | null;
    customer_name: string;
    days_overdue: number;
    outstanding: number;
  }>(
    `SELECT customer_id, customer_name,
       CAST(julianday('now') - julianday(due_date) AS INTEGER) AS days_overdue,
       (total - amount_paid) AS outstanding
     FROM invoices
     WHERE status NOT IN ('paid','cancelled') AND total > amount_paid`,
  );

  const map = new Map<string, AgedReceivable>();
  for (const r of rows) {
    const key = r.customer_id || `name:${r.customer_name}`;
    if (!map.has(key)) {
      map.set(key, {
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        current: 0, days_30: 0, days_60: 0, days_90: 0, total: 0,
      });
    }
    const agg = map.get(key)!;
    if (r.days_overdue <= 30) agg.current += r.outstanding;
    else if (r.days_overdue <= 60) agg.days_30 += r.outstanding;
    else if (r.days_overdue <= 90) agg.days_60 += r.outstanding;
    else agg.days_90 += r.outstanding;
    agg.total += r.outstanding;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
