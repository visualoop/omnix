/**
 * Settlement payments — pay down customer credit balances and supplier
 * amounts owed. Tracks each payment with method + reference (M-Pesa code,
 * cheque number, etc.) for reconciliation.
 */
import { query, execute } from "@/lib/db";

export type PaymentMethod = "cash" | "mpesa" | "card" | "bank" | "other";

export interface SettlementPayment {
  id: string;
  customer_id?: string;
  supplier_id?: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  user_id: string;
  paid_at: string;
  created_at: string;
}

// ─── Customer payments ──────────────────────────────────────────────────
export async function recordCustomerPayment(
  customerId: string,
  amount: number,
  method: PaymentMethod,
  userId: string,
  reference?: string,
  note?: string,
): Promise<string> {
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO customer_payments (id, customer_id, amount, method, reference, note, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [id, customerId, amount, method, reference || null, note || null, userId],
  );
  // Decrement balance owed
  await execute(
    `UPDATE customers SET balance = MAX(0, balance - ?1) WHERE id = ?2`,
    [amount, customerId],
  );
  return id;
}

export async function listCustomerPayments(customerId: string): Promise<SettlementPayment[]> {
  return query<SettlementPayment>(
    `SELECT * FROM customer_payments WHERE customer_id = ?1 ORDER BY paid_at DESC`,
    [customerId],
  );
}

// ─── Supplier payments ──────────────────────────────────────────────────
export async function recordSupplierPayment(
  supplierId: string,
  amount: number,
  method: PaymentMethod,
  userId: string,
  reference?: string,
  note?: string,
): Promise<string> {
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO supplier_payments (id, supplier_id, amount, method, reference, note, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [id, supplierId, amount, method, reference || null, note || null, userId],
  );
  await execute(
    `UPDATE suppliers SET balance_owed = MAX(0, balance_owed - ?1) WHERE id = ?2`,
    [amount, supplierId],
  );
  return id;
}

export async function listSupplierPayments(supplierId: string): Promise<SettlementPayment[]> {
  return query<SettlementPayment>(
    `SELECT * FROM supplier_payments WHERE supplier_id = ?1 ORDER BY paid_at DESC`,
    [supplierId],
  );
}

// ─── Aggregate reports ──────────────────────────────────────────────────
export async function getTodayPayments(): Promise<{
  customer_total: number;
  supplier_total: number;
  customer_count: number;
  supplier_count: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const [cust] = await query<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM customer_payments WHERE date(paid_at) = ?1`,
    [today],
  );
  const [supp] = await query<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM supplier_payments WHERE date(paid_at) = ?1`,
    [today],
  );
  return {
    customer_total: cust?.total || 0,
    supplier_total: supp?.total || 0,
    customer_count: cust?.count || 0,
    supplier_count: supp?.count || 0,
  };
}
