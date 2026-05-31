import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface ExpenseCategory {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface Expense {
  id: string;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  description: string | null;
  payment_method: string;
  reference: string | null;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

export interface CreateExpenseInput {
  category_id: string;
  category_name: string;
  amount: number;
  description?: string;
  payment_method?: string;
  reference?: string;
  expense_date?: string;
  notes?: string;
}

export interface CashShift {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_closing: number | null;
  actual_closing: number | null;
  difference: number | null;
  cash_in: number;
  cash_out: number;
  notes: string | null;
  status: "open" | "closed";
}

export interface PnLData {
  revenue: {
    sales_cash: number;
    sales_credit: number;
    sales_other: number;
    returns: number;
    other_income: number;
    total: number;
  };
  cogs: number;
  returned_cogs: number;
  gross_profit: number;
  expenses: Array<{ category: string; amount: number }>;
  total_expenses: number;
  net_profit: number;
  margin: number;
}

// Expense categories
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  return query<ExpenseCategory>("SELECT * FROM expense_categories ORDER BY sort_order");
}

// Expenses
export async function getExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
  let sql = "SELECT * FROM expenses WHERE 1=1";
  const params: unknown[] = [];
  if (startDate) { sql += ` AND expense_date >= ?${params.length + 1}`; params.push(startDate); }
  if (endDate) { sql += ` AND expense_date <= ?${params.length + 1}`; params.push(endDate); }
  sql += " ORDER BY expense_date DESC, created_at DESC LIMIT 200";
  return query<Expense>(sql, params);
}

export async function createExpense(input: CreateExpenseInput, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO expenses (id, category_id, category_name, amount, description, payment_method, reference, expense_date, notes, recorded_by, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [id, input.category_id, input.category_name, input.amount, input.description || null,
     input.payment_method || "cash", input.reference || null,
     input.expense_date || new Date().toISOString().slice(0, 10),
     input.notes || null, userId, getActiveBranchId()]
  );

  // Mirror to bank as withdrawal for reconciliation
  try {
    const { recordTransaction } = await import("./banking");
    const accountId = await pickAccountForMethod(input.payment_method || "cash");
    if (accountId) {
      await recordTransaction({
        account_id: accountId,
        transaction_type: "withdrawal",
        amount: input.amount,
        description: `${input.category_name}: ${input.description || ""}`.trim().slice(0, 200),
        payment_method: input.payment_method || "cash",
        reference: input.reference || undefined,
        transaction_date: input.expense_date,
        related_expense_id: id,
        user_id: userId,
      });
    }
  } catch (e) {
    console.warn("Bank txn mirror failed:", e);
  }

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

export async function deleteExpense(id: string): Promise<void> {
  await execute("DELETE FROM expenses WHERE id = ?1", [id]);
}

// Cash register / shift management
export async function getOpenShift(userId: string): Promise<CashShift | null> {
  const rows = await query<CashShift>(
    "SELECT * FROM cash_register WHERE user_id = ?1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

export async function openShift(userId: string, openingBalance: number): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO cash_register (id, user_id, opening_balance, status, branch_id)
     VALUES (?1, ?2, ?3, 'open', ?4)`,
    [id, userId, openingBalance, getActiveBranchId()]
  );
  return id;
}

export async function closeShift(shiftId: string, actualClosing: number, notes?: string): Promise<void> {
  // Calculate expected closing from sales + opening balance
  const shift = await query<CashShift>(
    "SELECT * FROM cash_register WHERE id = ?1",
    [shiftId]
  );
  if (!shift[0]) throw new Error("Shift not found");

  const cashSales = await query<{ total: number }>(
    `SELECT COALESCE(SUM(p.amount), 0) as total
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE p.method_id = 'cash' AND s.created_at >= ?1`,
    [shift[0].opened_at]
  );

  const expensesPaid = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE payment_method = 'cash' AND created_at >= ?1`,
    [shift[0].opened_at]
  );

  const expected = shift[0].opening_balance + (cashSales[0]?.total || 0) - (expensesPaid[0]?.total || 0);
  const difference = actualClosing - expected;

  await execute(
    `UPDATE cash_register 
     SET status = 'closed', closed_at = datetime('now'),
         expected_closing = ?1, actual_closing = ?2, difference = ?3,
         cash_in = ?4, cash_out = ?5, notes = ?6
     WHERE id = ?7`,
    [expected, actualClosing, difference, cashSales[0]?.total || 0, expensesPaid[0]?.total || 0, notes || null, shiftId]
  );
}

export async function getRecentShifts(limit = 20): Promise<CashShift[]> {
  return query<CashShift>("SELECT * FROM cash_register ORDER BY opened_at DESC LIMIT ?1", [limit]);
}

// P&L report
export async function getPnL(startDate: string, endDate: string): Promise<PnLData> {
  // Sales revenue
  const salesByMethod = await query<{ method_id: string; total: number }>(
    `SELECT p.method_id, COALESCE(SUM(p.amount), 0) as total
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.status = 'completed' AND date(s.created_at) BETWEEN ?1 AND ?2
     GROUP BY p.method_id`,
    [startDate, endDate]
  );

  let sales_cash = 0, sales_credit = 0, sales_other = 0;
  for (const row of salesByMethod) {
    if (row.method_id === "cash") sales_cash = row.total;
    else if (row.method_id === "credit") sales_credit = row.total;
    else sales_other += row.total;
  }

  const otherIncome = await query<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM other_income WHERE date(income_date) BETWEEN ?1 AND ?2",
    [startDate, endDate]
  );

  const returns = await query<{ total: number }>(
    `SELECT COALESCE(SUM(refund_amount), 0) as total
     FROM sale_returns
     WHERE date(return_date) BETWEEN ?1 AND ?2`,
    [startDate, endDate]
  );
  const returnsAmount = returns[0]?.total || 0;
  const totalRevenue = sales_cash + sales_credit + sales_other - returnsAmount + (otherIncome[0]?.total || 0);

  // COGS — buying price * quantity sold
  const cogs = await query<{ total: number }>(
    `SELECT COALESCE(SUM(COALESCE(b.buying_price, 0) * si.quantity), 0) as total
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN batches b ON b.id = si.batch_id
     WHERE s.status = 'completed' AND date(s.created_at) BETWEEN ?1 AND ?2`,
    [startDate, endDate]
  );

  const returnedCogs = await query<{ total: number }>(
    `SELECT COALESCE(SUM(
       COALESCE(
         b.buying_price,
         (SELECT b2.buying_price FROM batches b2 WHERE b2.product_id = sri.product_id ORDER BY b2.received_at DESC LIMIT 1),
         0
       ) * sri.quantity
     ), 0) as total
     FROM sale_return_items sri
     JOIN sale_returns sr ON sr.id = sri.return_id
     LEFT JOIN sale_items si ON si.id = sri.sale_item_id
     LEFT JOIN batches b ON b.id = si.batch_id
     WHERE date(sr.return_date) BETWEEN ?1 AND ?2`,
    [startDate, endDate]
  );

  // Expenses by category
  const expenses = await query<{ category: string; amount: number }>(
    `SELECT COALESCE(category_name, 'Uncategorized') as category, SUM(amount) as amount
     FROM expenses WHERE date(expense_date) BETWEEN ?1 AND ?2
     GROUP BY category_name ORDER BY amount DESC`,
    [startDate, endDate]
  );

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const returnedCogsAmount = returnedCogs[0]?.total || 0;
  const cogsAmount = Math.max(0, (cogs[0]?.total || 0) - returnedCogsAmount);
  const grossProfit = totalRevenue - cogsAmount;
  const netProfit = grossProfit - totalExpenses;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    revenue: {
      sales_cash,
      sales_credit,
      sales_other,
      returns: returnsAmount,
      other_income: otherIncome[0]?.total || 0,
      total: totalRevenue,
    },
    cogs: cogsAmount,
    returned_cogs: returnedCogsAmount,
    gross_profit: grossProfit,
    expenses,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    margin,
  };
}
