# Phase 5B — Basic Accounting & Financial Management

## Why This Matters
A pharmacy owner needs to know: "Am I profitable? What are my expenses? How much cash do I have?" Without basic accounting, they need a separate tool (or don't track finances at all).

## Scope
This is NOT full accounting software (not Sage/QuickBooks). It's basic financial tracking that a pharmacy owner can manage without an accountant.

## Tasks

### 5B.1 Database Schema
```sql
accounts (id, name, type, balance, parent_id, code)
-- Types: asset, liability, income, expense, equity

expense_categories (id, name, parent_id)
expenses (id, category_id, amount, description, payment_method,
          reference, receipt_image, recorded_by, expense_date, created_at)
income_sources (id, name, type) -- sales, insurance_payments, other
cash_register (id, device_id, opened_at, closed_at, opening_balance,
               expected_closing, actual_closing, difference, notes, user_id)
```

### 5B.2 Expense Tracking
- Record business expenses (rent, utilities, salaries, supplies, etc.)
- Categorize expenses
- Attach receipt photo (stored locally)
- Payment method used
- Recurring expense setup (e.g., rent every 1st)
- Monthly expense summary

### 5B.3 Income Tracking (Automatic)
- Sales revenue auto-recorded from POS
- Insurance payments received (from claims module)
- Other income (manual entry: e.g., rental income, consulting)

### 5B.4 Profit & Loss Report
```
Revenue
  Sales (cash)           KES 450,000
  Sales (insurance)      KES 180,000
  Other income           KES  10,000
                        ───────────
  Total Revenue          KES 640,000

Cost of Goods Sold
  Purchases              KES 380,000
                        ───────────
  Gross Profit           KES 260,000

Expenses
  Rent                   KES  50,000
  Salaries               KES  80,000
  Utilities              KES  12,000
  Other                  KES  15,000
                        ───────────
  Total Expenses         KES 157,000

NET PROFIT               KES 103,000
```

### 5B.5 Cash Flow Tracking
- Opening balance each day (shift open)
- Cash in: cash sales + insurance payments received
- Cash out: expenses paid in cash + supplier payments
- Closing balance (should match physical count)
- Variance tracking (cash over/short)

### 5B.6 Cash Register / Shift Management
- Open shift: enter opening cash balance
- During shift: system tracks all cash transactions
- Close shift: enter physical cash count
- System calculates expected vs actual
- Flag variances > threshold (configurable)
- Shift report (printable)

### 5B.7 Financial Dashboard
- Today's revenue vs yesterday
- Monthly P&L at a glance
- Cash position right now
- Outstanding receivables (insurance + customer credit)
- Outstanding payables (supplier balances)
- Expense trend (month over month)

### 5B.8 Bank/Mobile Money Reconciliation (Basic)
- Record bank deposits
- Record M-Pesa withdrawals to bank
- Track float across: cash register, M-Pesa till, bank account
- No bank API integration (manual recording)

## Done When
- Expenses can be recorded with categories
- P&L report generates correctly with real data
- Cash register shift open/close works
- Cash variance detected and flagged
- Financial dashboard shows live business health
- Outstanding receivables/payables visible
