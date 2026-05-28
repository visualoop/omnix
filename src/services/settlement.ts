/**
 * Settlement payments — pay down customer credit balances and supplier
 * amounts owed. Tracks each payment with method + reference (M-Pesa code,
 * cheque number, etc.) for reconciliation.
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

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
    `INSERT INTO customer_payments (id, customer_id, amount, method, reference, note, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [id, customerId, amount, method, reference || null, note || null, userId, getActiveBranchId()],
  );
  // Decrement balance owed
  await execute(
    `UPDATE customers SET balance = MAX(0, balance - ?1) WHERE id = ?2`,
    [amount, customerId],
  );

  // Mirror to bank as deposit
  try {
    const { recordTransaction } = await import("./banking");
    const accountId = await pickAccountForMethod(method);
    if (accountId) {
      const [cust] = await query<{ name: string }>(`SELECT name FROM customers WHERE id = ?1`, [customerId]);
      await recordTransaction({
        account_id: accountId,
        transaction_type: "deposit",
        amount,
        description: `Customer payment: ${cust?.name || customerId}`,
        counterparty_name: cust?.name,
        payment_method: method,
        reference: reference || undefined,
        related_customer_payment_id: id,
        user_id: userId,
      });
    }
  } catch (e) { console.warn("Bank txn mirror failed:", e); }

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
    `INSERT INTO supplier_payments (id, supplier_id, amount, method, reference, note, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [id, supplierId, amount, method, reference || null, note || null, userId, getActiveBranchId()],
  );
  await execute(
    `UPDATE suppliers SET balance_owed = MAX(0, balance_owed - ?1) WHERE id = ?2`,
    [amount, supplierId],
  );

  // Mirror to bank as withdrawal
  try {
    const { recordTransaction } = await import("./banking");
    const accountId = await pickAccountForMethod(method);
    if (accountId) {
      const [sup] = await query<{ name: string }>(`SELECT name FROM suppliers WHERE id = ?1`, [supplierId]);
      await recordTransaction({
        account_id: accountId,
        transaction_type: "withdrawal",
        amount,
        description: `Supplier payment: ${sup?.name || supplierId}`,
        counterparty_name: sup?.name,
        payment_method: method,
        reference: reference || undefined,
        related_supplier_payment_id: id,
        user_id: userId,
      });
    }
  } catch (e) { console.warn("Bank txn mirror failed:", e); }

  return id;
}

async function pickAccountForMethod(method: string): Promise<string | null> {
  const lower = method.toLowerCase();
  if (lower.includes("mpesa") || lower.includes("m-pesa")) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type IN ('mpesa_till','mpesa_paybill') AND is_active = 1 LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
  }
  if (lower.includes("bank") || lower.includes("cheque") || lower.includes("transfer") || lower.includes("card")) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type = 'bank' AND is_active = 1 ORDER BY is_default DESC LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
  }
  if (lower.includes("cash")) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type = 'cash_box' AND is_active = 1 ORDER BY is_default DESC LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
  }
  const rows = await query<{ id: string }>(
    `SELECT id FROM bank_accounts WHERE is_active = 1 ORDER BY is_default DESC LIMIT 1`,
  );
  return rows[0]?.id || null;
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
