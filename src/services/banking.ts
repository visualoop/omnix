/**
 * Banking service — accounts, transactions, reconciliation.
 *
 * Concepts:
 * - BankAccount: any cash store (real bank, M-Pesa till, cash box, etc.)
 * - BankTransaction: every cash movement, with optional link to a source record
 * - StatementImport: a bank statement upload session with line-by-line matching
 *
 * For Kenya: M-Pesa tills/paybills are first-class (account_type='mpesa_till'/'mpesa_paybill').
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export type BankAccountType = "bank" | "mpesa_till" | "mpesa_paybill" | "cash_box" | "credit_card" | "mobile_money";
export type BankTxType = "deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "fee" | "interest" | "adjustment";

export interface BankAccount {
  id: string;
  name: string;
  account_type: BankAccountType;
  bank_name: string | null;
  account_number: string | null;
  branch: string | null;
  currency: string;
  opening_balance: number;
  opening_date: string;
  current_balance: number;
  is_default: number;
  is_active: number;
  notes: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  transaction_type: BankTxType;
  amount: number;
  balance_after: number | null;
  reference: string | null;
  description: string;
  counterparty_name: string | null;
  payment_method: string | null;
  related_sale_id: string | null;
  related_expense_id: string | null;
  related_customer_payment_id: string | null;
  related_supplier_payment_id: string | null;
  related_invoice_payment_id: string | null;
  related_transfer_id: string | null;
  reconciled: number;
  reconciled_at: string | null;
  reconciled_by: string | null;
  statement_line_ref: string | null;
  user_id: string;
  branch_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface BankTransactionWithAccount extends BankTransaction {
  account_name: string;
  account_type: BankAccountType;
}

// ─── Account CRUD ──────────────────────────────────────────────────────
export async function listBankAccounts(includeInactive = false): Promise<BankAccount[]> {
  const where = includeInactive ? "" : "WHERE is_active = 1";
  return query<BankAccount>(`SELECT * FROM bank_accounts ${where} ORDER BY is_default DESC, name`);
}

export async function getBankAccount(id: string): Promise<BankAccount | null> {
  const rows = await query<BankAccount>(`SELECT * FROM bank_accounts WHERE id = ?1`, [id]);
  return rows[0] || null;
}

export async function upsertBankAccount(input: Partial<BankAccount> & { name: string; account_type: BankAccountType }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE bank_accounts SET name=?2, account_type=?3, bank_name=?4, account_number=?5,
        branch=?6, currency=?7, opening_balance=?8, opening_date=?9, is_default=?10, is_active=?11, notes=?12
       WHERE id=?1`,
      [id, input.name, input.account_type, input.bank_name || null, input.account_number || null,
        input.branch || null, input.currency || "KES", input.opening_balance || 0,
        input.opening_date || new Date().toISOString().slice(0, 10),
        input.is_default ?? 0, input.is_active ?? 1, input.notes || null],
    );
  } else {
    await execute(
      `INSERT INTO bank_accounts (id, name, account_type, bank_name, account_number, branch, currency,
         opening_balance, opening_date, current_balance, is_default, is_active, notes, branch_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      [id, input.name, input.account_type, input.bank_name || null, input.account_number || null,
        input.branch || null, input.currency || "KES",
        input.opening_balance || 0, input.opening_date || new Date().toISOString().slice(0, 10),
        input.opening_balance || 0,
        input.is_default ?? 0, input.is_active ?? 1, input.notes || null,
        input.branch_id || getActiveBranchId()],
    );
  }
  // Ensure exactly one default
  if (input.is_default) {
    await execute(`UPDATE bank_accounts SET is_default = 0 WHERE id != ?1`, [id]);
  }
  return id;
}

export async function setDefaultAccount(id: string): Promise<void> {
  await execute(`UPDATE bank_accounts SET is_default = 0`);
  await execute(`UPDATE bank_accounts SET is_default = 1 WHERE id = ?1`, [id]);
}

export async function deactivateAccount(id: string): Promise<void> {
  await execute(`UPDATE bank_accounts SET is_active = 0 WHERE id = ?1`, [id]);
}

// ─── Recompute balance after txn ───────────────────────────────────────
async function recomputeBalance(accountId: string): Promise<void> {
  const [account] = await query<{ opening_balance: number }>(
    `SELECT opening_balance FROM bank_accounts WHERE id = ?1`, [accountId],
  );
  if (!account) return;

  const [agg] = await query<{ total_in: number; total_out: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS total_out
     FROM bank_transactions WHERE account_id = ?1`,
    [accountId],
  );

  const balance = account.opening_balance + (agg.total_in || 0) - (agg.total_out || 0);
  await execute(
    `UPDATE bank_accounts SET current_balance = ?2 WHERE id = ?1`,
    [accountId, balance],
  );
}

// ─── Transactions ──────────────────────────────────────────────────────
export async function listTransactions(opts?: {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  reconciled?: boolean;
  branchId?: string;
  limit?: number;
}): Promise<BankTransactionWithAccount[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.accountId) { conditions.push(`t.account_id = ?${params.length + 1}`); params.push(opts.accountId); }
  if (opts?.startDate) { conditions.push(`t.transaction_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`t.transaction_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  if (opts?.reconciled !== undefined) { conditions.push(`t.reconciled = ?${params.length + 1}`); params.push(opts.reconciled ? 1 : 0); }
  if (opts?.branchId) { conditions.push(`t.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<BankTransactionWithAccount>(
    `SELECT t.*, a.name AS account_name, a.account_type
     FROM bank_transactions t
     JOIN bank_accounts a ON a.id = t.account_id
     ${where}
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT ${opts?.limit || 500}`,
    params,
  );
}

export async function recordTransaction(input: {
  account_id: string;
  transaction_date?: string;
  transaction_type: BankTxType;
  amount: number;
  reference?: string;
  description: string;
  counterparty_name?: string;
  payment_method?: string;
  related_sale_id?: string;
  related_expense_id?: string;
  related_customer_payment_id?: string;
  related_supplier_payment_id?: string;
  related_invoice_payment_id?: string;
  user_id: string;
  notes?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO bank_transactions (
       id, account_id, transaction_date, transaction_type, amount,
       reference, description, counterparty_name, payment_method,
       related_sale_id, related_expense_id, related_customer_payment_id,
       related_supplier_payment_id, related_invoice_payment_id,
       user_id, branch_id, notes
     ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`,
    [id, input.account_id,
      input.transaction_date || new Date().toISOString().slice(0, 10),
      input.transaction_type, Math.abs(input.amount),
      input.reference || null, input.description,
      input.counterparty_name || null, input.payment_method || null,
      input.related_sale_id || null, input.related_expense_id || null,
      input.related_customer_payment_id || null,
      input.related_supplier_payment_id || null,
      input.related_invoice_payment_id || null,
      input.user_id, getActiveBranchId(), input.notes || null],
  );
  await recomputeBalance(input.account_id);
  return id;
}

/** Inter-account transfer creates two linked transactions. */
export async function recordTransfer(input: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transaction_date?: string;
  reference?: string;
  description?: string;
  user_id: string;
}): Promise<{ outId: string; inId: string }> {
  const transferId = crypto.randomUUID();
  const outId = crypto.randomUUID();
  const inId = crypto.randomUUID();
  const date = input.transaction_date || new Date().toISOString().slice(0, 10);
  const desc = input.description || "Inter-account transfer";

  await execute(
    `INSERT INTO bank_transactions (
       id, account_id, transaction_date, transaction_type, amount,
       reference, description, payment_method, related_transfer_id,
       user_id, branch_id
     ) VALUES (?1,?2,?3,'transfer_out',?4,?5,?6,'transfer',?7,?8,?9)`,
    [outId, input.from_account_id, date, input.amount, input.reference || null, desc, transferId, input.user_id, getActiveBranchId()],
  );
  await execute(
    `INSERT INTO bank_transactions (
       id, account_id, transaction_date, transaction_type, amount,
       reference, description, payment_method, related_transfer_id,
       user_id, branch_id
     ) VALUES (?1,?2,?3,'transfer_in',?4,?5,?6,'transfer',?7,?8,?9)`,
    [inId, input.to_account_id, date, input.amount, input.reference || null, desc, transferId, input.user_id, getActiveBranchId()],
  );
  await recomputeBalance(input.from_account_id);
  await recomputeBalance(input.to_account_id);
  return { outId, inId };
}

export async function deleteTransaction(id: string): Promise<void> {
  const [tx] = await query<{ account_id: string }>(`SELECT account_id FROM bank_transactions WHERE id = ?1`, [id]);
  if (!tx) return;
  await execute(`DELETE FROM bank_transactions WHERE id = ?1`, [id]);
  await recomputeBalance(tx.account_id);
}

export async function markReconciled(ids: string[], userId: string, statementRef?: string): Promise<void> {
  for (const id of ids) {
    await execute(
      `UPDATE bank_transactions SET reconciled = 1, reconciled_at = datetime('now'), reconciled_by = ?2, statement_line_ref = ?3
       WHERE id = ?1`,
      [id, userId, statementRef || null],
    );
  }
}

export async function unreconcile(id: string): Promise<void> {
  await execute(
    `UPDATE bank_transactions SET reconciled = 0, reconciled_at = NULL, reconciled_by = NULL, statement_line_ref = NULL
     WHERE id = ?1`, [id],
  );
}

// ─── Reconciliation summary ────────────────────────────────────────────
export interface ReconciliationSummary {
  account_id: string;
  account_name: string;
  current_balance: number;
  reconciled_balance: number;
  unreconciled_in: number;
  unreconciled_out: number;
  unreconciled_count: number;
}

export async function getReconciliationSummary(accountId: string): Promise<ReconciliationSummary | null> {
  const [account] = await query<{ name: string; current_balance: number; opening_balance: number }>(
    `SELECT name, current_balance, opening_balance FROM bank_accounts WHERE id = ?1`, [accountId],
  );
  if (!account) return null;

  const [recon] = await query<{ total_in: number; total_out: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS total_out
     FROM bank_transactions WHERE account_id = ?1 AND reconciled = 1`,
    [accountId],
  );

  const [unrecon] = await query<{ total_in: number; total_out: number; cnt: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS total_out,
       COUNT(*) AS cnt
     FROM bank_transactions WHERE account_id = ?1 AND reconciled = 0`,
    [accountId],
  );

  return {
    account_id: accountId,
    account_name: account.name,
    current_balance: account.current_balance,
    reconciled_balance: account.opening_balance + (recon.total_in || 0) - (recon.total_out || 0),
    unreconciled_in: unrecon.total_in || 0,
    unreconciled_out: unrecon.total_out || 0,
    unreconciled_count: unrecon.cnt || 0,
  };
}

// ─── Statement Import ──────────────────────────────────────────────────
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
  raw_data: string | null;
}

export interface StatementImport {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  statement_starting_balance: number;
  statement_ending_balance: number;
  line_count: number;
  matched_count: number;
  unmatched_count: number;
  file_name: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
}

/** Create import + lines, attempt auto-match against existing transactions. */
export async function createStatementImport(input: {
  account_id: string;
  period_start: string;
  period_end: string;
  starting_balance: number;
  ending_balance: number;
  file_name?: string;
  user_id: string;
  lines: Array<{
    line_date: string;
    line_description: string;
    line_reference?: string;
    debit: number;
    credit: number;
    balance?: number;
  }>;
}): Promise<{ importId: string; matched: number; unmatched: number }> {
  const importId = crypto.randomUUID();
  await execute(
    `INSERT INTO bank_statement_imports (id, account_id, period_start, period_end,
       statement_starting_balance, statement_ending_balance, line_count, file_name, user_id)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
    [importId, input.account_id, input.period_start, input.period_end,
      input.starting_balance, input.ending_balance, input.lines.length,
      input.file_name || null, input.user_id],
  );

  // Get existing unreconciled transactions for the period
  const candidates = await query<BankTransaction>(
    `SELECT * FROM bank_transactions
     WHERE account_id = ?1 AND transaction_date BETWEEN ?2 AND ?3 AND reconciled = 0`,
    [input.account_id, input.period_start, input.period_end],
  );

  let matched = 0;
  let unmatched = 0;

  for (const ln of input.lines) {
    const lineId = crypto.randomUUID();

    // Auto-match: by reference (exact), then by amount + date (within 2 days)
    const lineAmount = ln.credit > 0 ? ln.credit : ln.debit;
    const expectedType: BankTxType[] = ln.credit > 0
      ? ["deposit", "transfer_in", "interest"]
      : ["withdrawal", "transfer_out", "fee"];

    let match: BankTransaction | undefined;
    if (ln.line_reference) {
      match = candidates.find((c) =>
        c.reference === ln.line_reference &&
        Math.abs(c.amount - lineAmount) < 0.01 &&
        expectedType.includes(c.transaction_type),
      );
    }
    if (!match) {
      // Try amount + date proximity (±2 days)
      match = candidates.find((c) =>
        Math.abs(c.amount - lineAmount) < 0.01 &&
        expectedType.includes(c.transaction_type) &&
        Math.abs(new Date(c.transaction_date).getTime() - new Date(ln.line_date).getTime()) <= 2 * 86400000 &&
        !candidates.find((cc) => cc !== c && cc.reference === c.reference), // not yet claimed
      );
    }

    if (match) {
      // Remove from candidates so we don't double-match
      const idx = candidates.indexOf(match);
      if (idx > -1) candidates.splice(idx, 1);

      await execute(
        `UPDATE bank_transactions SET reconciled = 1, reconciled_at = datetime('now'), reconciled_by = ?2, statement_line_ref = ?3
         WHERE id = ?1`,
        [match.id, input.user_id, ln.line_reference || lineId],
      );
      matched++;
      await execute(
        `INSERT INTO bank_statement_lines (id, import_id, line_date, line_description, line_reference,
           debit, credit, balance, matched_transaction_id, is_matched)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)`,
        [lineId, importId, ln.line_date, ln.line_description, ln.line_reference || null,
          ln.debit, ln.credit, ln.balance ?? null, match.id],
      );
    } else {
      unmatched++;
      await execute(
        `INSERT INTO bank_statement_lines (id, import_id, line_date, line_description, line_reference,
           debit, credit, balance, is_matched)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0)`,
        [lineId, importId, ln.line_date, ln.line_description, ln.line_reference || null,
          ln.debit, ln.credit, ln.balance ?? null],
      );
    }
  }

  await execute(
    `UPDATE bank_statement_imports SET matched_count = ?2, unmatched_count = ?3 WHERE id = ?1`,
    [importId, matched, unmatched],
  );

  return { importId, matched, unmatched };
}

export async function listStatementImports(accountId?: string): Promise<StatementImport[]> {
  return query<StatementImport>(
    `SELECT * FROM bank_statement_imports
     ${accountId ? "WHERE account_id = ?1" : ""}
     ORDER BY created_at DESC
     LIMIT 200`,
    accountId ? [accountId] : [],
  );
}

export async function getStatementImport(id: string): Promise<{
  import: StatementImport;
  lines: StatementLine[];
} | null> {
  const [stmt] = await query<StatementImport>(`SELECT * FROM bank_statement_imports WHERE id = ?1`, [id]);
  if (!stmt) return null;
  const lines = await query<StatementLine>(
    `SELECT * FROM bank_statement_lines WHERE import_id = ?1 ORDER BY line_date, id`,
    [id],
  );
  return { import: stmt, lines };
}

/** Manually match a statement line to a transaction. */
export async function matchStatementLine(lineId: string, transactionId: string, userId: string): Promise<void> {
  await execute(
    `UPDATE bank_statement_lines SET matched_transaction_id = ?2, is_matched = 1 WHERE id = ?1`,
    [lineId, transactionId],
  );
  await execute(
    `UPDATE bank_transactions SET reconciled = 1, reconciled_at = datetime('now'), reconciled_by = ?2, statement_line_ref = ?3
     WHERE id = ?1`,
    [transactionId, userId, lineId],
  );
}

/** Create a new transaction directly from an unmatched statement line. */
export async function createTransactionFromLine(input: {
  line_id: string;
  account_id: string;
  description: string;
  counterparty_name?: string;
  user_id: string;
}): Promise<string> {
  const [line] = await query<StatementLine>(
    `SELECT * FROM bank_statement_lines WHERE id = ?1`, [input.line_id],
  );
  if (!line) throw new Error("Line not found");

  const txType: BankTxType = line.credit > 0 ? "deposit" : "withdrawal";
  const amount = line.credit > 0 ? line.credit : line.debit;

  const txId = await recordTransaction({
    account_id: input.account_id,
    transaction_date: line.line_date,
    transaction_type: txType,
    amount,
    reference: line.line_reference || undefined,
    description: input.description,
    counterparty_name: input.counterparty_name,
    user_id: input.user_id,
  });
  await matchStatementLine(input.line_id, txId, input.user_id);
  return txId;
}

// ─── CSV parser for bank statements ────────────────────────────────────
export interface ParsedCsv {
  lines: Array<{
    line_date: string;
    line_description: string;
    line_reference?: string;
    debit: number;
    credit: number;
    balance?: number;
  }>;
  detected_format: "kcb" | "equity" | "coop" | "mpesa" | "generic";
}

/**
 * Parse common Kenyan bank statement CSV formats.
 * Supports: KCB, Equity, Co-op, M-Pesa statement, generic 4-column.
 */
export function parseStatementCsv(text: string): ParsedCsv {
  const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => parseCsvRow(l));
  if (rows.length === 0) return { lines: [], detected_format: "generic" };

  // Find header row (first row that contains "date" or "transaction")
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const lower = rows[i].map((c) => c.toLowerCase());
    if (lower.some((c) => c.includes("date") || c.includes("time"))) {
      headerIdx = i;
      break;
    }
  }

  const header = rows[headerIdx].map((c) => c.toLowerCase().trim());
  const dataRows = rows.slice(headerIdx + 1);

  // Detect column indices
  const dateIdx = header.findIndex((c) => c.includes("date") || c.includes("time"));
  const descIdx = header.findIndex((c) => c.includes("description") || c.includes("particulars") || c.includes("narration") || c.includes("details"));
  const refIdx = header.findIndex((c) => c.includes("reference") || c.includes("ref") || c.includes("transaction id") || c.includes("receipt"));
  const debitIdx = header.findIndex((c) => c === "debit" || c === "withdrawal" || c.includes("debit") || c.includes("paid out"));
  const creditIdx = header.findIndex((c) => c === "credit" || c === "deposit" || c.includes("credit") || c.includes("paid in") || c.includes("received"));
  const amountIdx = header.findIndex((c) => c === "amount" || c.includes("amount"));
  const balanceIdx = header.findIndex((c) => c.includes("balance"));

  // Detect format
  let format: ParsedCsv["detected_format"] = "generic";
  if (header.some((c) => c.includes("paid in") && c.includes("paid out") === false) || header.some((c) => c.includes("transaction status"))) format = "mpesa";
  else if (header.some((c) => c.includes("particulars"))) format = "equity";
  else if (header.some((c) => c.includes("narration"))) format = "kcb";

  const lines: ParsedCsv["lines"] = [];
  for (const row of dataRows) {
    if (row.length < 2) continue;

    const dateStr = row[dateIdx] || row[0] || "";
    const date = parseDate(dateStr);
    if (!date) continue;

    const desc = (row[descIdx] || row[1] || "").trim();
    if (!desc) continue;

    const ref = refIdx >= 0 ? row[refIdx]?.trim() : "";

    let debit = 0, credit = 0;
    if (debitIdx >= 0) debit = parseAmount(row[debitIdx]);
    if (creditIdx >= 0) credit = parseAmount(row[creditIdx]);

    if (debit === 0 && credit === 0 && amountIdx >= 0) {
      const amt = parseAmount(row[amountIdx]);
      if (amt > 0) credit = amt;
      else debit = Math.abs(amt);
    }

    if (debit === 0 && credit === 0) continue;

    const balance = balanceIdx >= 0 ? parseAmount(row[balanceIdx]) || undefined : undefined;

    lines.push({
      line_date: date,
      line_description: desc,
      line_reference: ref || undefined,
      debit,
      credit,
      balance,
    });
  }

  return { lines, detected_format: format };
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseAmount(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(str: string): string | null {
  if (!str) return null;
  // Try ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Try dd/mm/yyyy or dd-mm-yyyy
  const m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try Date constructor
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}
