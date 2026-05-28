/**
 * Petty Cash — separate from main till
 *
 * For small expenses paid from a "float" outside the main register
 * (tea, fuel, paper, etc.). Logs top-ups, expenses, reimbursements.
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface PettyCashEntry {
  id: string;
  amount: number;        // positive = topup, negative = expense
  type: "topup" | "expense" | "reimbursement" | "count_adjustment";
  description: string;
  receipt_ref: string | null;
  user_id: string;
  user_name?: string;
  transaction_date: string;
  created_at: string;
}

export interface PettyCashSummary {
  current_balance: number;
  topup_total: number;
  expense_total: number;
  count: number;
}

export async function recordPettyCash(input: {
  amount: number;
  type: PettyCashEntry["type"];
  description: string;
  receipt_ref?: string;
  user_id: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  // Normalize sign: expenses are negative, topups are positive
  const signed = (input.type === "expense" || (input.type === "count_adjustment" && input.amount < 0))
    ? -Math.abs(input.amount)
    : Math.abs(input.amount);
  await execute(
    `INSERT INTO petty_cash (id, amount, type, description, receipt_ref, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [id, signed, input.type, input.description, input.receipt_ref || null, input.user_id, getActiveBranchId()],
  );
  return id;
}

export async function listPettyCash(limit = 50, fromDate?: string): Promise<PettyCashEntry[]> {
  const params: any[] = [limit];
  let where = "";
  if (fromDate) {
    where = "WHERE p.transaction_date >= ?2";
    params.push(fromDate);
  }
  return query<PettyCashEntry>(
    `SELECT p.*, COALESCE(u.full_name, u.username) AS user_name
     FROM petty_cash p
     LEFT JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT ?1`,
    params,
  );
}

export async function getPettyCashSummary(fromDate?: string): Promise<PettyCashSummary> {
  const params: any[] = [];
  let where = "";
  if (fromDate) {
    where = "WHERE transaction_date >= ?1";
    params.push(fromDate);
  }
  const [r] = await query<{
    balance: number; topup: number; expense: number; count: number;
  }>(
    `SELECT
       COALESCE(SUM(amount), 0) AS balance,
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS topup,
       COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS expense,
       COUNT(*) AS count
     FROM petty_cash ${where}`,
    params,
  );
  return {
    current_balance: r?.balance || 0,
    topup_total: r?.topup || 0,
    expense_total: r?.expense || 0,
    count: r?.count || 0,
  };
}
