/**
 * Recurring invoices + credit notes service.
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";
import { createInvoice, markInvoiceSent } from "@/services/invoicing";

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";

export interface RecurringTemplate {
  id: string;
  name: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_tax_pin: string | null;
  frequency: RecurringFrequency;
  interval_count: number;
  starts_on: string;
  ends_on: string | null;
  next_run_on: string;
  last_run_on: string | null;
  invoices_generated: number;
  payment_terms_days: number;
  notes: string | null;
  terms: string | null;
  is_active: number;
  auto_send: number;
  user_id: string;
  branch_id: string | null;
  created_at: string;
}

export interface RecurringTemplateItem {
  id: string;
  template_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  sort_order: number;
}

// ─── CRUD ──────────────────────────────────────────────────────────────
export async function listRecurringTemplates(activeOnly = false): Promise<RecurringTemplate[]> {
  return query<RecurringTemplate>(
    `SELECT * FROM recurring_invoice_templates ${activeOnly ? "WHERE is_active = 1" : ""}
     ORDER BY is_active DESC, next_run_on ASC`,
  );
}

export async function getRecurringTemplate(id: string): Promise<{ template: RecurringTemplate; items: RecurringTemplateItem[] } | null> {
  const [tmpl] = await query<RecurringTemplate>(`SELECT * FROM recurring_invoice_templates WHERE id = ?1`, [id]);
  if (!tmpl) return null;
  const items = await query<RecurringTemplateItem>(
    `SELECT * FROM recurring_invoice_items WHERE template_id = ?1 ORDER BY sort_order`,
    [id],
  );
  return { template: tmpl, items };
}

export async function createRecurringTemplate(input: {
  name: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_tax_pin?: string;
  frequency: RecurringFrequency;
  interval_count?: number;
  starts_on: string;
  ends_on?: string;
  payment_terms_days?: number;
  notes?: string;
  terms?: string;
  auto_send?: boolean;
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
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO recurring_invoice_templates (
       id, name, customer_id, customer_name, customer_phone, customer_email, customer_address, customer_tax_pin,
       frequency, interval_count, starts_on, ends_on, next_run_on,
       payment_terms_days, notes, terms, auto_send, user_id, branch_id
     ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)`,
    [
      id, input.name, input.customer_id || null, input.customer_name,
      input.customer_phone || null, input.customer_email || null,
      input.customer_address || null, input.customer_tax_pin || null,
      input.frequency, input.interval_count || 1,
      input.starts_on, input.ends_on || null, input.starts_on,
      input.payment_terms_days || 30, input.notes || null, input.terms || null,
      input.auto_send ? 1 : 0, input.user_id, getActiveBranchId(),
    ],
  );
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    await execute(
      `INSERT INTO recurring_invoice_items (id, template_id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      [crypto.randomUUID(), id, it.product_id || null, it.description, it.quantity, it.unit || "pcs",
        it.unit_price, it.tax_rate || 0, it.discount_amount || 0, i],
    );
  }
  return id;
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  await execute(`UPDATE recurring_invoice_templates SET is_active = ?2 WHERE id = ?1`, [id, active ? 1 : 0]);
}

export async function deleteTemplate(id: string): Promise<void> {
  await execute(`DELETE FROM recurring_invoice_items WHERE template_id = ?1`, [id]);
  await execute(`DELETE FROM recurring_invoice_templates WHERE id = ?1`, [id]);
}

// ─── Generation ────────────────────────────────────────────────────────
function addInterval(date: string, freq: RecurringFrequency, count: number): string {
  const d = new Date(date);
  switch (freq) {
    case "weekly": d.setDate(d.getDate() + 7 * count); break;
    case "biweekly": d.setDate(d.getDate() + 14 * count); break;
    case "monthly": d.setMonth(d.getMonth() + count); break;
    case "quarterly": d.setMonth(d.getMonth() + 3 * count); break;
    case "annually": d.setFullYear(d.getFullYear() + count); break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Run scheduled recurring templates. Generates invoices for any template whose
 * next_run_on <= today, then advances next_run_on by frequency.
 */
export async function runRecurringSchedule(userId: string): Promise<{ generated: number; templates: number; errors: string[] }> {
  const today = new Date().toISOString().slice(0, 10);
  const due = await query<RecurringTemplate>(
    `SELECT * FROM recurring_invoice_templates
     WHERE is_active = 1 AND next_run_on <= ?1 AND (ends_on IS NULL OR ends_on >= ?1)`,
    [today],
  );
  const errors: string[] = [];
  let generated = 0;

  for (const tmpl of due) {
    try {
      const data = await getRecurringTemplate(tmpl.id);
      if (!data || data.items.length === 0) continue;

      // Calculate due date
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + tmpl.payment_terms_days);

      // Create the invoice
      const invoiceId = await createInvoice({
        customer_id: tmpl.customer_id || undefined,
        customer_name: tmpl.customer_name,
        customer_phone: tmpl.customer_phone || undefined,
        customer_email: tmpl.customer_email || undefined,
        customer_address: tmpl.customer_address || undefined,
        customer_tax_pin: tmpl.customer_tax_pin || undefined,
        issue_date: today,
        due_date: dueDate.toISOString().slice(0, 10),
        notes: tmpl.notes || `Recurring invoice from ${tmpl.name}`,
        terms: tmpl.terms || undefined,
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
      });

      // Mark sent if auto_send
      if (tmpl.auto_send === 1) {
        await markInvoiceSent(invoiceId);
      }

      // Advance schedule
      const nextRun = addInterval(today, tmpl.frequency, tmpl.interval_count);
      await execute(
        `UPDATE recurring_invoice_templates
         SET next_run_on = ?2, last_run_on = ?3, invoices_generated = invoices_generated + 1
         WHERE id = ?1`,
        [tmpl.id, nextRun, today],
      );
      generated++;
    } catch (e) {
      errors.push(`${tmpl.name}: ${String(e)}`);
    }
  }

  return { generated, templates: due.length, errors };
}

// ─── Credit Notes ──────────────────────────────────────────────────────
export type CreditReason = "return" | "overcharge" | "discount" | "correction" | "damaged" | "other";

export interface CreditNote {
  id: string;
  credit_note_number: string;
  invoice_id: string;
  customer_id: string | null;
  customer_name: string;
  issue_date: string;
  reason: CreditReason;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  user_id: string;
  branch_id: string | null;
  created_at: string;
}

export interface CreditNoteItem {
  id: string;
  credit_note_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

async function nextCreditNoteNumber(): Promise<string> {
  const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
  const [r] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM credit_notes WHERE credit_note_number LIKE ?1`,
    [`CN-${yyyymm}-%`],
  );
  return `CN-${yyyymm}-${String((r?.count || 0) + 1).padStart(4, "0")}`;
}

export async function listCreditNotes(invoiceId?: string): Promise<CreditNote[]> {
  return query<CreditNote>(
    `SELECT * FROM credit_notes ${invoiceId ? "WHERE invoice_id = ?1" : ""} ORDER BY created_at DESC LIMIT 500`,
    invoiceId ? [invoiceId] : [],
  );
}

export async function getCreditNote(id: string): Promise<{ note: CreditNote; items: CreditNoteItem[] } | null> {
  const [note] = await query<CreditNote>(`SELECT * FROM credit_notes WHERE id = ?1`, [id]);
  if (!note) return null;
  const items = await query<CreditNoteItem>(
    `SELECT * FROM credit_note_items WHERE credit_note_id = ?1`,
    [id],
  );
  return { note, items };
}

export async function createCreditNote(input: {
  invoice_id: string;
  customer_id?: string;
  customer_name: string;
  reason: CreditReason;
  notes?: string;
  user_id: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
  }>;
}): Promise<string> {
  if (input.items.length === 0) throw new Error("Add at least one item");

  const id = crypto.randomUUID();
  const number = await nextCreditNoteNumber();
  let subtotal = 0;
  let taxAmount = 0;

  await execute(
    `INSERT INTO credit_notes (id, credit_note_number, invoice_id, customer_id, customer_name, reason, notes, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [id, number, input.invoice_id, input.customer_id || null, input.customer_name,
      input.reason, input.notes || null, input.user_id, getActiveBranchId()],
  );

  for (const it of input.items) {
    const lineSubtotal = it.quantity * it.unit_price;
    const lineTax = lineSubtotal * (it.tax_rate || 0) / 100;
    const lineTotal = lineSubtotal + lineTax;
    subtotal += lineSubtotal;
    taxAmount += lineTax;
    await execute(
      `INSERT INTO credit_note_items (id, credit_note_id, description, quantity, unit_price, tax_rate, line_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      [crypto.randomUUID(), id, it.description, it.quantity, it.unit_price, it.tax_rate || 0, lineTotal],
    );
  }

  const total = subtotal + taxAmount;
  await execute(
    `UPDATE credit_notes SET subtotal = ?2, tax_amount = ?3, total = ?4 WHERE id = ?1`,
    [id, subtotal, taxAmount, total],
  );

  // Reduce the invoice's outstanding balance — treat as a payment
  await execute(
    `INSERT INTO invoice_payments (id, invoice_id, amount, payment_method, reference, payment_date, notes, user_id)
     VALUES (?1, ?2, ?3, 'credit_note', ?4, date('now'), ?5, ?6)`,
    [crypto.randomUUID(), input.invoice_id, total, number, `Credit note: ${input.reason}`, input.user_id],
  );

  // Recompute invoice status
  const [inv] = await query<{ total: number; amount_paid: number }>(
    `SELECT total, COALESCE(SUM(p.amount), 0) AS amount_paid FROM invoices i
     LEFT JOIN invoice_payments p ON p.invoice_id = i.id
     WHERE i.id = ?1 GROUP BY i.id`,
    [input.invoice_id],
  );
  let newStatus: string;
  if (inv.amount_paid >= inv.total) newStatus = "paid";
  else if (inv.amount_paid > 0) newStatus = "partial";
  else newStatus = "sent";
  await execute(
    `UPDATE invoices SET amount_paid = ?2, status = ?3, updated_at = datetime('now') WHERE id = ?1`,
    [input.invoice_id, inv.amount_paid, newStatus],
  );

  return id;
}
