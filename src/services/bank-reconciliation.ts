/**
 * Bank reconciliation.
 *
 * Uses bank_statement_imports + bank_statement_lines from migration 019.
 */
import { execute, query } from "@/lib/db";
import { requireBranchOwnedRecord } from "@/lib/branch-ownership";
import { requireActiveBranchId } from "@/stores/active-branch";

export interface StatementLine {
  id: string;
  import_id: string;
  line_date: string;
  line_description: string;
  line_reference: string | null;
  debit: number;
  credit: number;
  balance: number | null;
  matched_transaction_id: string | null;
  is_matched: number;
}

export interface BookTxn {
  id: string;
  bank_account_id: string;
  txn_date: string;
  description: string | null;
  amount: number;
  transaction_type: string;
  matched: number;
}

export async function listStatementLines(bankAccountId: string, unmatchedOnly = false): Promise<StatementLine[]> {
  await requireBranchOwnedRecord("bank_accounts", bankAccountId, "Bank account");
  const where = unmatchedOnly ? "AND l.is_matched = 0" : "";
  return query<StatementLine>(
    `SELECT l.id, l.import_id, l.line_date, l.line_description, l.line_reference,
            l.debit, l.credit, l.balance, l.matched_transaction_id, l.is_matched
     FROM bank_statement_lines l
     JOIN bank_statement_imports i ON i.id = l.import_id
     WHERE i.bank_account_id = ?1 ${where}
     ORDER BY l.line_date ASC, l.id ASC
     LIMIT 500`,
    [bankAccountId],
  ).catch(() => []);
}

export async function listCandidateTxns(bankAccountId: string): Promise<BookTxn[]> {
  const branchId = await requireBranchOwnedRecord("bank_accounts", bankAccountId, "Bank account");
  return query<BookTxn>(
    `SELECT id, bank_account_id, txn_date, description, amount, transaction_type,
            CASE WHEN id IN (SELECT matched_transaction_id FROM bank_statement_lines WHERE matched_transaction_id IS NOT NULL) THEN 1 ELSE 0 END AS matched
     FROM bank_transactions
     WHERE bank_account_id = ?1 AND branch_id = ?2
     ORDER BY txn_date DESC
     LIMIT 500`,
    [bankAccountId, branchId],
  ).catch(() => []);
}

export async function matchLine(lineId: string, txnId: string): Promise<void> {
  const branchId = requireActiveBranchId();
  const [owned] = await query<{ id: string }>(
    `SELECT l.id FROM bank_statement_lines l
     JOIN bank_statement_imports i ON i.id = l.import_id
     JOIN bank_accounts a ON a.id = i.bank_account_id
     JOIN bank_transactions t ON t.id = ?2 AND t.bank_account_id = a.id AND t.branch_id = a.branch_id
     WHERE l.id = ?1 AND a.branch_id = ?3`,
    [lineId, txnId, branchId],
  );
  if (!owned) throw new Error("Statement line or transaction not found in the active branch account");
  await execute(
    `UPDATE bank_statement_lines SET matched_transaction_id = ?2, is_matched = 1 WHERE id = ?1`,
    [lineId, txnId],
  );
}

export async function unmatchLine(lineId: string): Promise<void> {
  const [owned] = await query<{ id: string }>(
    `SELECT l.id FROM bank_statement_lines l
     JOIN bank_statement_imports i ON i.id = l.import_id
     JOIN bank_accounts a ON a.id = i.bank_account_id
     WHERE l.id = ?1 AND a.branch_id = ?2`,
    [lineId, requireActiveBranchId()],
  );
  if (!owned) throw new Error("Statement line not found in an active-branch account");
  await execute(
    `UPDATE bank_statement_lines SET matched_transaction_id = NULL, is_matched = 0 WHERE id = ?1`,
    [lineId],
  );
}

export interface ReconciliationSummary {
  statement_total: number;
  book_total: number;
  matched_count: number;
  unmatched_lines: number;
  unmatched_txns: number;
  variance: number;
}

export async function summarise(bankAccountId: string): Promise<ReconciliationSummary> {
  const branchId = await requireBranchOwnedRecord("bank_accounts", bankAccountId, "Bank account");
  const [statement] = await query<{ total: number; unmatched: number }>(
    `SELECT COALESCE(SUM(l.credit - l.debit), 0) AS total,
            COALESCE(SUM(CASE WHEN l.is_matched = 0 THEN 1 ELSE 0 END), 0) AS unmatched
     FROM bank_statement_lines l
     JOIN bank_statement_imports i ON i.id = l.import_id
     WHERE i.bank_account_id = ?1`,
    [bankAccountId],
  ).catch(() => [{ total: 0, unmatched: 0 }]);

  const [book] = await query<{ total: number; unmatched: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total,
            COALESCE(SUM(CASE WHEN id NOT IN (SELECT matched_transaction_id FROM bank_statement_lines WHERE matched_transaction_id IS NOT NULL) THEN 1 ELSE 0 END), 0) AS unmatched
     FROM bank_transactions
     WHERE bank_account_id = ?1 AND branch_id = ?2`,
    [bankAccountId, branchId],
  ).catch(() => [{ total: 0, unmatched: 0 }]);

  const [matched] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM bank_statement_lines l
     JOIN bank_statement_imports i ON i.id = l.import_id
     WHERE i.bank_account_id = ?1 AND l.is_matched = 1`,
    [bankAccountId],
  ).catch(() => [{ n: 0 }]);

  return {
    statement_total: statement?.total ?? 0,
    book_total: book?.total ?? 0,
    matched_count: matched?.n ?? 0,
    unmatched_lines: statement?.unmatched ?? 0,
    unmatched_txns: book?.unmatched ?? 0,
    variance: (statement?.total ?? 0) - (book?.total ?? 0),
  };
}
