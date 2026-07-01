/**
 * Debit notes + supplier returns.
 *
 * Debit note = "we're taking money off what we owe you" (over-invoiced, defective).
 * Supplier return = physical goods sent back (typically linked to a debit note).
 * Supplier statement = printable AP ledger for a supplier over a period.
 */
import { execute, query } from "@/lib/db";

export type DebitNoteReason = "over_invoice" | "return" | "damage" | "price_adjustment";
export type DebitNoteStatus = "draft" | "issued" | "applied" | "cancelled";

export interface DebitNote {
  id: string;
  note_number: string;
  supplier_id: string | null;
  purchase_order_id: string | null;
  goods_receipt_id: string | null;
  issue_date: string;
  reason: DebitNoteReason;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: DebitNoteStatus;
  notes: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

async function nextNoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(note_number, 9) AS INTEGER)), 0) AS n
     FROM debit_notes WHERE note_number LIKE ?1`,
    [`DN-${year}-%`],
  );
  return `DN-${year}-${String(Number(row?.n ?? 0) + 1).padStart(6, "0")}`;
}

export async function createDebitNote(input: {
  supplier_id: string;
  purchase_order_id?: string;
  goods_receipt_id?: string;
  reason: DebitNoteReason;
  items: Array<{
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
  }>;
  notes?: string;
  created_by?: string;
}): Promise<string> {
  const id = newId();
  const number = await nextNoteNumber();
  const now = new Date().toISOString().slice(0, 10);

  let subtotal = 0;
  let tax = 0;
  for (const it of input.items) {
    const line = it.quantity * it.unit_price;
    subtotal += line;
    tax += line * ((it.tax_rate ?? 0) / 100);
  }
  const total = subtotal + tax;

  await execute(
    `INSERT INTO debit_notes
      (id, note_number, supplier_id, purchase_order_id, goods_receipt_id,
       issue_date, reason, subtotal, tax_amount, total_amount, status, notes, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'issued', ?11, ?12)`,
    [
      id, number, input.supplier_id, input.purchase_order_id ?? null,
      input.goods_receipt_id ?? null, now, input.reason,
      subtotal, tax, total, input.notes ?? null, input.created_by ?? null,
    ],
  );

  for (const it of input.items) {
    await execute(
      `INSERT INTO debit_note_items (id, debit_note_id, product_id, description, quantity, unit_price, tax_rate, line_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      [
        newId(), id, it.product_id ?? null, it.description, it.quantity,
        it.unit_price, it.tax_rate ?? 0, it.quantity * it.unit_price,
      ],
    );
  }
  return id;
}

export async function listDebitNotes(supplierId?: string): Promise<DebitNote[]> {
  if (supplierId) {
    return query<DebitNote>(
      `SELECT * FROM debit_notes WHERE supplier_id = ?1 ORDER BY issue_date DESC`,
      [supplierId],
    );
  }
  return query<DebitNote>(`SELECT * FROM debit_notes ORDER BY issue_date DESC LIMIT 500`);
}

// ─── Supplier returns ─────────────────────────────────────
async function nextReturnNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(return_number, 9) AS INTEGER)), 0) AS n
     FROM supplier_returns WHERE return_number LIKE ?1`,
    [`SR-${year}-%`],
  );
  return `SR-${year}-${String(Number(row?.n ?? 0) + 1).padStart(6, "0")}`;
}

export async function createSupplierReturn(input: {
  supplier_id: string;
  goods_receipt_id?: string;
  debit_note_id?: string;
  reason?: string;
  items: Array<{ product_id: string; batch_id?: string; quantity: number; unit_cost: number; reason?: string }>;
  notes?: string;
  created_by?: string;
}): Promise<string> {
  const id = newId();
  const number = await nextReturnNumber();
  await execute(
    `INSERT INTO supplier_returns
      (id, return_number, supplier_id, goods_receipt_id, debit_note_id, return_date, reason, status, notes, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, date('now'), ?6, 'sent', ?7, ?8)`,
    [id, number, input.supplier_id, input.goods_receipt_id ?? null, input.debit_note_id ?? null, input.reason ?? null, input.notes ?? null, input.created_by ?? null],
  );
  for (const it of input.items) {
    await execute(
      `INSERT INTO supplier_return_items (id, supplier_return_id, product_id, batch_id, quantity, unit_cost, reason)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      [newId(), id, it.product_id, it.batch_id ?? null, it.quantity, it.unit_cost, it.reason ?? null],
    );
    // Reduce batch quantity if applicable.
    if (it.batch_id) {
      await execute(
        `UPDATE batches SET quantity = MAX(0, quantity - ?2) WHERE id = ?1`,
        [it.batch_id, it.quantity],
      );
    }
  }
  return id;
}

// ─── Supplier statements ──────────────────────────────────
export interface SupplierStatementRow {
  date: string;
  ref: string;
  description: string;
  debit: number;   // increases AP (invoice / GRN)
  credit: number;  // decreases AP (payment / debit note)
  balance: number;
}

export interface SupplierStatement {
  supplier_id: string;
  supplier_name: string;
  period: { from: string; to: string };
  opening: number;
  rows: SupplierStatementRow[];
  closing: number;
  total_debit: number;
  total_credit: number;
}

export async function getSupplierStatement(supplierId: string, from: string, to: string): Promise<SupplierStatement> {
  const [sup] = await query<{ name: string }>(
    `SELECT name FROM suppliers WHERE id = ?1`,
    [supplierId],
  );

  // Union of goods_receipts (invoices), supplier_payments, debit_notes.
  const items = await query<{
    date: string;
    ref: string;
    description: string;
    debit: number;
    credit: number;
  }>(
    `SELECT date, ref, description, debit, credit FROM (
        SELECT gr.received_at AS date, gr.grn_number AS ref,
               'Goods received' AS description, gr.total AS debit, 0 AS credit
        FROM goods_receipts gr WHERE gr.supplier_id = ?1 AND gr.received_at BETWEEN ?2 AND ?3

        UNION ALL
        SELECT sp.payment_date AS date, COALESCE(sp.reference, sp.id) AS ref,
               'Payment' AS description, 0 AS debit, sp.amount AS credit
        FROM supplier_payments sp WHERE sp.supplier_id = ?1 AND sp.payment_date BETWEEN ?2 AND ?3

        UNION ALL
        SELECT dn.issue_date AS date, dn.note_number AS ref,
               'Debit note (' || dn.reason || ')' AS description, 0 AS debit, dn.total_amount AS credit
        FROM debit_notes dn WHERE dn.supplier_id = ?1 AND dn.status != 'cancelled' AND dn.issue_date BETWEEN ?2 AND ?3
     ) ORDER BY date ASC`,
    [supplierId, from, to],
  ).catch(() => []);

  // Opening balance = sum of same three sources BEFORE `from`.
  const [openRow] = await query<{ balance: number }>(
    `SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS balance FROM (
        SELECT gr.total AS debit, 0 AS credit
        FROM goods_receipts gr WHERE gr.supplier_id = ?1 AND gr.received_at < ?2
        UNION ALL
        SELECT 0, sp.amount FROM supplier_payments sp WHERE sp.supplier_id = ?1 AND sp.payment_date < ?2
        UNION ALL
        SELECT 0, dn.total_amount FROM debit_notes dn WHERE dn.supplier_id = ?1 AND dn.status != 'cancelled' AND dn.issue_date < ?2
     )`,
    [supplierId, from],
  ).catch(() => [{ balance: 0 }]);
  const opening = openRow?.balance ?? 0;

  let running = opening;
  const rows: SupplierStatementRow[] = items.map((it) => {
    running += (it.debit || 0) - (it.credit || 0);
    return { ...it, balance: running };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return {
    supplier_id: supplierId,
    supplier_name: sup?.name || "(unknown)",
    period: { from, to },
    opening,
    rows,
    closing: running,
    total_debit: totalDebit,
    total_credit: totalCredit,
  };
}
