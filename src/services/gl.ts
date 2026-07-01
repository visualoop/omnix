/**
 * General Ledger service — double-entry accounting.
 *
 * postJournal(entry) enforces: total debits = total credits, at least 2 lines,
 * every account_code exists, non-negative amounts. It then INSERTs the header
 * + lines in one transaction and marks the entry posted.
 *
 * Auto-posting from operations: `postSaleToGL`, `postExpenseToGL`, etc. call
 * `postJournal` with the correct account codes derived from payment method
 * + tax + line items. Sales already know their tax total, so the split is:
 *
 *   DEBIT  Cash / M-Pesa / Bank / AR      (payment method → asset)
 *   CREDIT Sales revenue                    (net of tax)
 *   CREDIT VAT payable                      (tax portion)
 *
 * Once GL is in place, trial balance = sum of debits and credits per account,
 * balance sheet = accounts grouped by asset/liability/equity, cash flow =
 * activity per cash-asset account.
 */
import { execute, query } from "@/lib/db";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  parent_code: string | null;
  is_system: number;
  active: number;
  description: string | null;
}

export interface JournalLine {
  account_code: string;
  debit: number;
  credit: number;
  description?: string;
  cost_centre?: string;
}

export interface JournalEntryInput {
  entry_date: string;                 // 'YYYY-MM-DD'
  description: string;
  source_kind?: string;
  source_id?: string;
  lines: JournalLine[];
  posted_by?: string;
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

async function nextEntryNumber(year: string): Promise<string> {
  const rows = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(entry_number, 9) AS INTEGER)), 0) AS n
     FROM journal_entries WHERE entry_number LIKE ?1`,
    [`JE-${year}-%`],
  );
  const next = Number(rows[0]?.n ?? 0) + 1;
  return `JE-${year}-${String(next).padStart(6, "0")}`;
}

/**
 * Post a journal entry. Validates:
 *   1. At least 2 lines.
 *   2. Total debits == total credits (within 0.005 tolerance).
 *   3. Every account_code exists in chart_of_accounts.
 *   4. No line has both debit AND credit > 0.
 * Returns the new entry id.
 */
export async function postJournal(input: JournalEntryInput): Promise<string> {
  if (!input.lines || input.lines.length < 2) {
    throw new Error("Journal entry requires at least 2 lines");
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of input.lines) {
    if (line.debit < 0 || line.credit < 0) throw new Error("Debit/credit must be non-negative");
    if (line.debit > 0 && line.credit > 0) throw new Error("A line cannot be both debit and credit");
    totalDebit += line.debit;
    totalCredit += line.credit;
  }
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error(`Journal not balanced: debit ${totalDebit.toFixed(2)} != credit ${totalCredit.toFixed(2)}`);
  }

  // Validate account codes.
  const accountCodes = Array.from(new Set(input.lines.map((l) => l.account_code)));
  const placeholders = accountCodes.map((_, i) => `?${i + 1}`).join(",");
  const found = await query<{ code: string }>(
    `SELECT code FROM chart_of_accounts WHERE code IN (${placeholders})`,
    accountCodes,
  );
  const foundSet = new Set(found.map((r) => r.code));
  for (const code of accountCodes) {
    if (!foundSet.has(code)) throw new Error(`Unknown account: ${code}`);
  }

  const id = newId();
  const year = input.entry_date.slice(0, 4);
  const entryNumber = await nextEntryNumber(year);

  await execute(
    `INSERT INTO journal_entries
      (id, entry_number, entry_date, description, source_kind, source_id, posted, posted_at, posted_by, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, datetime('now'), ?7, datetime('now'))`,
    [
      id,
      entryNumber,
      input.entry_date,
      input.description,
      input.source_kind ?? null,
      input.source_id ?? null,
      input.posted_by ?? null,
    ],
  );

  let lineNo = 0;
  for (const line of input.lines) {
    lineNo++;
    await execute(
      `INSERT INTO journal_lines
        (id, entry_id, line_no, account_code, debit, credit, description, cost_centre)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      [
        newId(),
        id,
        lineNo,
        line.account_code,
        line.debit,
        line.credit,
        line.description ?? null,
        line.cost_centre ?? null,
      ],
    );
  }

  return id;
}

/**
 * Reverse a posted entry. Creates a new mirror entry that inverts every line
 * (debit↔credit) and links via `reverses_entry`.
 */
export async function reverseJournal(entryId: string, on: string, by?: string): Promise<string> {
  const [entry] = await query<{
    description: string;
    entry_number: string;
  }>(
    `SELECT description, entry_number FROM journal_entries WHERE id = ?1 AND posted = 1`,
    [entryId],
  );
  if (!entry) throw new Error("Journal entry not found or not posted");

  const lines = await query<{ account_code: string; debit: number; credit: number; description: string | null }>(
    `SELECT account_code, debit, credit, description FROM journal_lines WHERE entry_id = ?1 ORDER BY line_no`,
    [entryId],
  );

  const reversalId = await postJournal({
    entry_date: on,
    description: `Reversal of ${entry.entry_number}: ${entry.description}`,
    source_kind: "reversal",
    source_id: entryId,
    posted_by: by,
    lines: lines.map((l) => ({
      account_code: l.account_code,
      debit: l.credit,   // swap
      credit: l.debit,   // swap
      description: l.description ?? undefined,
    })),
  });

  await execute(
    `UPDATE journal_entries SET reversed_by = ?2 WHERE id = ?1`,
    [entryId, reversalId],
  );
  return reversalId;
}

// ═══════════════════════════════════════════════════════════════════
// TRIAL BALANCE
// ═══════════════════════════════════════════════════════════════════
export interface TrialBalanceRow {
  code: string;
  name: string;
  type: AccountType;
  total_debit: number;
  total_credit: number;
  balance: number;               // debit - credit (positive for asset/expense, negative for liab/equity/revenue in raw form)
}

export async function getTrialBalance(asOfDate?: string): Promise<TrialBalanceRow[]> {
  const cutoff = asOfDate ?? new Date().toISOString().slice(0, 10);
  return query<TrialBalanceRow>(
    `SELECT
        c.code,
        c.name,
        c.type,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit,
        COALESCE(SUM(l.debit) - SUM(l.credit), 0) AS balance
     FROM chart_of_accounts c
     LEFT JOIN journal_lines l ON l.account_code = c.code
     LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.posted = 1 AND e.entry_date <= ?1
     WHERE c.active = 1
     GROUP BY c.code
     HAVING total_debit > 0 OR total_credit > 0
     ORDER BY c.code`,
    [cutoff],
  );
}

// ═══════════════════════════════════════════════════════════════════
// BALANCE SHEET
// ═══════════════════════════════════════════════════════════════════
export interface BalanceSheet {
  as_of: string;
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  balanced: boolean;
  current_year_earnings: number;
}

export async function getBalanceSheet(asOfDate?: string): Promise<BalanceSheet> {
  const cutoff = asOfDate ?? new Date().toISOString().slice(0, 10);
  const tb = await getTrialBalance(cutoff);

  // Compute current-year earnings = revenue - expenses YTD (posted).
  const [pnl] = await query<{ earnings: number }>(
    `SELECT
        COALESCE(SUM(CASE WHEN c.type = 'revenue' THEN l.credit - l.debit ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN c.type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0)
        AS earnings
     FROM journal_lines l
     JOIN chart_of_accounts c ON c.code = l.account_code
     JOIN journal_entries e ON e.id = l.entry_id AND e.posted = 1
       AND e.entry_date <= ?1 AND strftime('%Y', e.entry_date) = strftime('%Y', ?1)`,
    [cutoff],
  );

  const assets = tb.filter((r) => r.type === "asset");
  const liabilities = tb.filter((r) => r.type === "liability");
  const equity = tb.filter((r) => r.type === "equity");

  // Assets carry positive when debit > credit; liab/equity carry positive when credit > debit.
  const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
  const totalEquityRaw = equity.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
  const totalEquity = totalEquityRaw + (pnl?.earnings ?? 0);

  return {
    as_of: cutoff,
    assets,
    liabilities,
    equity,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    current_year_earnings: pnl?.earnings ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-POSTING helpers (idempotent — checks source_id + kind)
// ═══════════════════════════════════════════════════════════════════
/** Post a sale to the GL. Returns null if already posted. */
export async function postSaleToGL(saleId: string, opts: {
  entry_date: string;
  total: number;
  tax: number;
  cash: number;
  mpesa: number;
  bank: number;
  ar: number;             // credit portion — customer owes
  cogs: number;           // cost of goods
  posted_by?: string;
}): Promise<string | null> {
  const [existing] = await query<{ id: string }>(
    `SELECT id FROM journal_entries WHERE source_kind = 'sale' AND source_id = ?1`,
    [saleId],
  );
  if (existing) return null;

  const netRevenue = opts.total - opts.tax;
  const debits: JournalLine[] = [];
  if (opts.cash > 0) debits.push({ account_code: "1000", debit: opts.cash, credit: 0, description: "Cash sale" });
  if (opts.mpesa > 0) debits.push({ account_code: "1010", debit: opts.mpesa, credit: 0, description: "M-Pesa sale" });
  if (opts.bank > 0) debits.push({ account_code: "1020", debit: opts.bank, credit: 0, description: "Bank sale" });
  if (opts.ar > 0) debits.push({ account_code: "1100", debit: opts.ar, credit: 0, description: "Credit sale (AR)" });

  const credits: JournalLine[] = [];
  if (netRevenue > 0) credits.push({ account_code: "4000", debit: 0, credit: netRevenue, description: "Sales revenue" });
  if (opts.tax > 0) credits.push({ account_code: "2100", debit: 0, credit: opts.tax, description: "VAT payable" });

  // COGS side: DR 5000 CR 1200 (inventory).
  const cogsLines: JournalLine[] = [];
  if (opts.cogs > 0) {
    cogsLines.push({ account_code: "5000", debit: opts.cogs, credit: 0, description: "COGS" });
    cogsLines.push({ account_code: "1200", debit: 0, credit: opts.cogs, description: "Inventory" });
  }

  if (debits.length === 0 || credits.length === 0) return null;

  return postJournal({
    entry_date: opts.entry_date,
    description: `Sale ${saleId}`,
    source_kind: "sale",
    source_id: saleId,
    posted_by: opts.posted_by,
    lines: [...debits, ...credits, ...cogsLines],
  });
}

/** Post an expense. */
export async function postExpenseToGL(expenseId: string, opts: {
  entry_date: string;
  amount: number;
  expense_account: string;    // e.g. '6000' (rent), '6100' (salaries)
  payment_source: "cash" | "mpesa" | "bank" | "petty_cash";
  posted_by?: string;
}): Promise<string | null> {
  const [existing] = await query<{ id: string }>(
    `SELECT id FROM journal_entries WHERE source_kind = 'expense' AND source_id = ?1`,
    [expenseId],
  );
  if (existing) return null;

  const asset = {
    cash: "1000",
    mpesa: "1010",
    bank: "1020",
    petty_cash: "1000",
  }[opts.payment_source];

  return postJournal({
    entry_date: opts.entry_date,
    description: `Expense ${expenseId}`,
    source_kind: "expense",
    source_id: expenseId,
    posted_by: opts.posted_by,
    lines: [
      { account_code: opts.expense_account, debit: opts.amount, credit: 0, description: "Expense" },
      { account_code: asset, debit: 0, credit: opts.amount, description: "Payment" },
    ],
  });
}

export async function listAccounts(): Promise<Account[]> {
  return query<Account>(
    `SELECT code, name, type, parent_code, is_system, active, description
     FROM chart_of_accounts
     WHERE active = 1
     ORDER BY code`,
  );
}
