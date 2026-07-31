/** Cashflow analytics scoped to the selected operational branch. */
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface CashflowDay {
  day: string;
  cash_in: number;
  cash_out: number;
  net: number;
}

function filters(opts?: { startDate?: string; endDate?: string; accountId?: string }): {
  where: string;
  params: unknown[];
} {
  const branchId = getActiveBranchId();
  const conditions = [branchId ? "branch_id = ?1" : "1 = 0"];
  const params: unknown[] = branchId ? [branchId] : [];
  if (opts?.startDate) { params.push(opts.startDate); conditions.push(`transaction_date >= ?${params.length}`); }
  if (opts?.endDate) { params.push(opts.endDate); conditions.push(`transaction_date <= ?${params.length}`); }
  if (opts?.accountId) { params.push(opts.accountId); conditions.push(`account_id = ?${params.length}`); }
  return { where: `WHERE ${conditions.join(" AND ")}`, params };
}

export async function getCashflowDaily(opts?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
}): Promise<CashflowDay[]> {
  const scoped = filters(opts);
  return query<CashflowDay>(
    `SELECT transaction_date AS day,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS cash_out,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount
                         WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN -amount ELSE 0 END), 0) AS net
     FROM bank_transactions ${scoped.where}
     GROUP BY transaction_date ORDER BY transaction_date`,
    scoped.params,
  );
}

export interface CashflowSource {
  source: string;
  cash_in: number;
  cash_out: number;
  count: number;
}

export async function getCashflowBySource(opts?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
}): Promise<CashflowSource[]> {
  const scoped = filters(opts);
  return query<CashflowSource>(
    `SELECT CASE
       WHEN related_sale_id IS NOT NULL THEN 'POS Sales'
       WHEN related_invoice_payment_id IS NOT NULL THEN 'Invoice Payments'
       WHEN related_customer_payment_id IS NOT NULL THEN 'Customer Payments'
       WHEN related_supplier_payment_id IS NOT NULL THEN 'Supplier Payments'
       WHEN related_expense_id IS NOT NULL THEN 'Expenses'
       WHEN transaction_type LIKE 'transfer%' THEN 'Inter-account Transfers'
       WHEN transaction_type = 'fee' THEN 'Bank Fees'
       WHEN transaction_type = 'interest' THEN 'Interest'
       ELSE 'Manual / Other' END AS source,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS cash_out,
       COUNT(*) AS count
     FROM bank_transactions ${scoped.where}
     GROUP BY source ORDER BY (cash_in + cash_out) DESC`,
    scoped.params,
  );
}
