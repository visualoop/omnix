# 02 — Core ERP Gaps

**Goal:** Make the Core ERP truly complete for a Kenyan SME, regardless of which vertical module is installed.

## Audit — what's MISSING from Core today

### 1. Branches / Multi-location 🔴 CRITICAL
Most Kenyan SMEs that grow open a 2nd shop within 12 months. Current system is single-location.
- Branches table: name, address, contact, manager_id
- Each sale, purchase, stock movement tagged with branch_id
- Stock per branch (or shared with branch overrides)
- Stock transfers between branches
- Branch-scoped reports
- User assigned to one or more branches
- "Switch branch" in topbar

### 2. Banking / Bank Reconciliation 🔴 CRITICAL
Owners deposit shop cash to bank. Need to reconcile.
- Bank accounts table: name, branch, account_no, currency
- Bank transactions: deposits, withdrawals, transfers
- Bank reconciliation: import bank statement (CSV / OFX), mark cleared
- Cash deposit slips (cash leaves till → goes to bank)

### 3. Employees / Payroll 🟡 (Full plan in [03-employees-hr.md](./03-employees-hr.md))
This is so big it gets its own plan file.

### 4. Owner Withdrawals / Drawings 🟡
- Owner takes cash for personal use → not an expense, it's a drawing
- Track in equity, not expense
- Show in P&L correctly

### 5. Recurring Expenses 🟡
- Rent, electricity, internet — happen every month
- Auto-create expense each month from a template
- Reminder before due date

### 6. Multi-currency basics 🟢 LOW for Kenya now
- Most SMEs are KES only. Skip for v1.

### 7. Vendors with multiple branches 🟡
- A supplier might have multiple delivery contacts / branches
- Vendor contacts table

### 8. Better reports
- Cash flow statement (not just P&L) 🟡
- Aged receivables (who owes us, how long) 🔴
- Aged payables (who we owe, how long) 🔴
- Stock movement / kardex per item 🟡
- Sales by hour (peak hours analysis) 🟢
- Sales by salesperson 🟡 (after employees ship)

### 9. Documents / attachments 🟡
- Attach scanned receipts to expenses
- Attach delivery notes to GRNs
- Attach invoices to PO
- Stored in `%APPDATA%/omnix/attachments/` with hash filename

### 10. Quotations / Estimates 🔴 CRITICAL for retail/hardware
- Issue a quotation before sale
- Convert quote → invoice → sale
- Track quote conversion rate

### 11. Invoicing (separate from POS) 🔴 CRITICAL
- POS = walk-in sale, paid immediately
- Invoice = B2B sale on credit, paid later
- Currently we have customer credit balance, but no formal invoice document
- Invoice needs: invoice no, due date, terms, line items, partial payments, aging

### 12. Delivery / Dispatch 🟡 retail relevance
- Delivery note when goods leave shop separate from sale
- Track who delivered, time, signature
- Useful when wholesale customer orders, we deliver

### 13. Communication log 🟢
- Log communications sent to customer (printed receipts, in-app reminders)
- Track payment reminders sent

### 14. Customer credit limits enforcement 🟡
- Currently customer.credit_limit is a field but we don't enforce
- POS should warn / block when adding sale that pushes balance over limit

### 15. Tax categories beyond VAT 🟡
- Withholding tax (WHT) 5% on services for VAT-registered suppliers
- Catering levy if restaurant module
- Tourism levy if hospitality
- Per-item tax rate is supported, just need UI

### 16. Audit log enrichment 🟢
- Currently logs login + license changes
- Should log: every price change, every refund, every void, every user role change

### 17. Backup / restore strengthening 🟡
- Encrypted backup option (passphrase)
- Cloud sync target (Dropbox / OneDrive folder)
- Verify backup integrity (checksums)

### 18. Module marketplace 🟢
- Modules page already exists — add a "Try" button for planned modules
- License upgrade flow for new module purchase

### 19. Tax invoice (compliant with KRA) 🔴
- Currently receipts are just receipts
- Need full Tax Invoice with: TIN, eTIMS QR code, invoice number sequence, customer details, separate VAT line per item
- Already partially via eTIMS — needs unified template

### 20. Payments split / partial 🟡
- POS already handles split payment (cash + mpesa). Verify
- Customer paying invoice in 3 installments — track properly

## Priority ladder

**P0 — must-have for Core completeness:**
1. Branches (#1)
2. Quotations + Invoices (#10, #11)
3. Aged receivables / payables (#8)
4. Bank accounts + reconciliation (#2)

**P1 — high value, adds quickly:**
5. Owner drawings (#4)
6. Recurring expenses (#5)
7. Customer credit limit enforcement (#14)
8. Documents/attachments (#9)
9. KRA-compliant tax invoice template (#19)

**P2 — quality of life:**
10. Audit log enrichment (#16)
11. Encrypted backups (#17)
12. Communication log (#13)
13. Cash flow statement (#8 cont.)
14. Sales-by-hour (#8 cont.)

**P3 — defer:**
- Multi-currency
- Module marketplace flow

## Implementation order (what we touch first locally)

1. **Branches** — adds branch_id everywhere; impacts schema deeply, do it before more features pile up
2. **Invoicing** + **Quotations** — natural after branches
3. **Aged receivables / payables** report
4. **Banking + reconciliation**
5. **Employees + Payroll** (separate plan)
6. **Recurring expenses** + **Owner drawings**

Each of those is a separate batch with its own migration + service + page + tests.

## Dependencies

- Branches must come BEFORE retail module since retail SMEs often have multiple shops
- Employees must come BEFORE Z-report by-cashier improvements
- Invoicing must come BEFORE meaningful aged-receivables
