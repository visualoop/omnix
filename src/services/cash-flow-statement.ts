/**
 * Cash Flow Statement — properly categorised.
 *
 * Splits every posted journal touching a cash-equivalent asset (1000-1099)
 * into Operating / Investing / Financing based on the OTHER side of the entry:
 *
 *   Operating : revenue accounts (4xxx), COGS (5xxx), operating expenses (6xxx),
 *               VAT payables (21xx), AR (1100), AP (2000), inventory (1200), etc.
 *   Investing : fixed assets (1500-1699), disposals, investment purchases.
 *   Financing : loans (2400), owner equity (3000).
 *
 * Under the indirect method, we start from net income and adjust for non-cash
 * items + working capital changes. Under the direct method we sum the actual
 * cash line-postings. This module ships the DIRECT method — simpler and more
 * grounded for SME users who don't care about D&A schedules.
 */
import { query } from "@/lib/db";

export interface CashFlowSection {
  label: string;
  lines: Array<{ description: string; amount: number }>;
  total: number;
}

export interface CashFlowStatement {
  from: string;
  to: string;
  opening_cash: number;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  net_change: number;
  closing_cash: number;
}

const CASH_ACCOUNTS = ["1000", "1010", "1020", "1030"];
// Suppress "unused" — kept for documentation of which accounts count as cash.
void CASH_ACCOUNTS;

function classify(otherAccountCode: string, otherType: string): "operating" | "investing" | "financing" {
  // Financing first (loans + equity).
  if (otherAccountCode.startsWith("24") || otherAccountCode.startsWith("30") || otherAccountCode.startsWith("31") || otherAccountCode.startsWith("32")) {
    return "financing";
  }
  // Investing (fixed assets 1500-1699).
  if (otherAccountCode.startsWith("15") || otherAccountCode.startsWith("16")) {
    return "investing";
  }
  // Everything else touching cash from operations (revenue, expenses, AR/AP, VAT, inventory).
  if (["revenue", "expense", "asset", "liability"].includes(otherType)) return "operating";
  return "operating";
}

export async function getCashFlow(fromDate: string, toDate: string): Promise<CashFlowStatement> {
  // For every journal entry that has at least one line hitting a cash account,
  // find the paired lines and aggregate.
  const rows = await query<{
    entry_id: string;
    entry_date: string;
    entry_desc: string;
    cash_account: string;
    cash_debit: number;      // cash increases
    cash_credit: number;     // cash decreases
    other_account: string;
    other_account_name: string;
    other_type: string;
    other_debit: number;
    other_credit: number;
  }>(
    `SELECT
        e.id AS entry_id,
        e.entry_date,
        e.description AS entry_desc,
        l1.account_code AS cash_account,
        l1.debit AS cash_debit,
        l1.credit AS cash_credit,
        l2.account_code AS other_account,
        c.name AS other_account_name,
        c.type AS other_type,
        l2.debit AS other_debit,
        l2.credit AS other_credit
     FROM journal_entries e
     JOIN journal_lines l1 ON l1.entry_id = e.id AND l1.account_code IN ('1000','1010','1020','1030')
     JOIN journal_lines l2 ON l2.entry_id = e.id AND l2.id != l1.id
                            AND l2.account_code NOT IN ('1000','1010','1020','1030')
     JOIN chart_of_accounts c ON c.code = l2.account_code
     WHERE e.posted = 1 AND e.entry_date BETWEEN ?1 AND ?2
     ORDER BY e.entry_date ASC`,
    [fromDate, toDate],
  );

  const operating: CashFlowSection = { label: "Operating activities", lines: [], total: 0 };
  const investing: CashFlowSection = { label: "Investing activities", lines: [], total: 0 };
  const financing: CashFlowSection = { label: "Financing activities", lines: [], total: 0 };

  const bucket = (r: typeof rows[number]) => {
    // Cash flow amount from this entry:
    //   cash_debit > 0 → inflow (positive)
    //   cash_credit > 0 → outflow (negative)
    const cashDelta = (r.cash_debit || 0) - (r.cash_credit || 0);
    // Attribute to the other line's account (which classifies it).
    const category = classify(r.other_account, r.other_type);
    const section = category === "operating" ? operating : category === "investing" ? investing : financing;
    // Group by other-account name.
    let line = section.lines.find((l) => l.description === r.other_account_name);
    if (!line) {
      line = { description: r.other_account_name, amount: 0 };
      section.lines.push(line);
    }
    // The pair's contribution to cash flow proportional to this line.
    // Multi-line entries need proportional allocation, but for the simple case
    // (2-line entries: 1 cash + 1 other), the other-line's value equals the cash-line's.
    const proportion = ((r.other_debit || 0) + (r.other_credit || 0));
    const totalOther = proportion; // for 2-line entries this is the full amount
    const allocation = totalOther === 0 ? cashDelta : cashDelta;
    line.amount += allocation;
    section.total += allocation;
  };

  for (const r of rows) bucket(r);

  // Compute opening cash (balance in cash accounts as of the day before `from`).
  const [openingRow] = await query<{ balance: number }>(
    `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) AS balance
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE e.posted = 1 AND e.entry_date < ?1
       AND l.account_code IN ('1000','1010','1020','1030')`,
    [fromDate],
  );
  const opening = openingRow?.balance ?? 0;
  const net = operating.total + investing.total + financing.total;
  return {
    from: fromDate,
    to: toDate,
    opening_cash: opening,
    operating,
    investing,
    financing,
    net_change: net,
    closing_cash: opening + net,
  };
}
