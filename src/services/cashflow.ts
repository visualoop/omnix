/**
 * Cashflow analytics — money in vs out over time, by account, by source.
 */
import { query } from "@/lib/db";

export interface CashflowDay {
  day: string;            // yyyy-mm-dd
  cash_in: number;
  cash_out: number;
  net: number;
}

export async function getCashflowDaily(opts?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
}): Promise<CashflowDay[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`transaction_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`transaction_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  if (opts?.accountId) { conditions.push(`account_id = ?${params.length + 1}`); params.push(opts.accountId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<CashflowDay>(
    `SELECT transaction_date AS day,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS cash_out,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount
                         WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN -amount
                         ELSE 0 END), 0) AS net
     FROM bank_transactions
     ${where}
     GROUP BY transaction_date
     ORDER BY transaction_date`,
    params,
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
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`transaction_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`transaction_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  if (opts?.accountId) { conditions.push(`account_id = ?${params.length + 1}`); params.push(opts.accountId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Source classification by which related FK is set
  return query<CashflowSource>(
    `SELECT
       CASE
         WHEN related_sale_id IS NOT NULL THEN 'POS Sales'
         WHEN related_invoice_payment_id IS NOT NULL THEN 'Invoice Payments'
         WHEN related_customer_payment_id IS NOT NULL THEN 'Customer Payments'
         WHEN related_supplier_payment_id IS NOT NULL THEN 'Supplier Payments'
         WHEN related_expense_id IS NOT NULL THEN 'Expenses'
         WHEN transaction_type LIKE 'transfer%' THEN 'Inter-account Transfers'
         WHEN transaction_type = 'fee' THEN 'Bank Fees'
         WHEN transaction_type = 'interest' THEN 'Interest'
         ELSE 'Manual / Other'
       END AS source,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS cash_out,
       COUNT(*) AS count
     FROM bank_transactions
     ${where}
     GROUP BY source
     ORDER BY (cash_in + cash_out) DESC`,
    params,
  );
}
