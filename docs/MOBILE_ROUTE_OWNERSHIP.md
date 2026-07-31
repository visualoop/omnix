# Task 17 — Android core operational ownership

This worktree owns the Android adaptation of the non-Settings Core, people, finance, audit, and manager-report operations listed below. Routing, the app shell, POS, business Settings, vertical-module pages, domain services, package manifests, Rust/Tauri, and CI remain outside this ownership boundary.

## Exact route ownership

| Area | Owned routes | Page implementation |
| --- | --- | --- |
| Dashboard | `/` | `dashboard.tsx`, `dashboard-insights.tsx` |
| Sales | `/sales`, `/sales/history`, `/sales/:id` | `hub-sales.tsx`, `sales-history.tsx`, `sale-detail.tsx` |
| Returns | `/returns`, `/returns/new` | `returns.tsx` |
| Customers and payments | `/customers`, `/customers/:id` | `customers.tsx`, `customer-detail.tsx` |
| Inventory and products | `/inventory`, `/inventory/products`, `/inventory/products/:id`, `/inventory/stock` | `hub-inventory.tsx`, `inventory.tsx`, `product-detail.tsx`, `stock.tsx` |
| Counts and transfers | `/stock-take`, `/stock-take/:id`, `/stock-transfers`, `/stock-transfers/new`, `/stock-transfers/:id` | `stock-take.tsx`, `stock-transfers.tsx`, `stock-transfer-new.tsx`, `stock-transfer-detail.tsx` |
| Suppliers | `/suppliers`, `/suppliers/:id` | `suppliers.tsx`, `supplier-detail.tsx` |
| Purchasing and GRN | `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/:id`; embedded goods-receipt history | `purchase-orders.tsx`, `goods-receipts.tsx` |
| Quotations and invoices | `/invoicing`, `/invoicing/invoice/new`, `/invoicing/quotation/new`, `/invoicing/invoice/:id`, `/invoicing/quotation/:id`, `/invoicing/recurring` | `invoicing.tsx`, `invoice-new.tsx`, `invoice-detail.tsx`, `recurring-invoices.tsx` |
| Expenses and petty cash | `/expenses`, `/petty-cash` | `expenses.tsx`, `petty-cash.tsx` |
| Banking and cash | `/banking`, `/banking/accounts`, `/banking/:id`, `/banking/:id/reconcile`, `/cash-register`, `/approvals` | `hub-banking.tsx`, `banking.tsx`, `banking-detail.tsx`, `bank-reconciliation.tsx`, `cash-register.tsx`, `approvals.tsx` |
| People | `/people`, `/hr/employees`, `/hr/employees/:id`, `/hr/attendance`, `/hr/leave` | `hub-people.tsx`, `employees.tsx`, `employee-detail.tsx`, `attendance.tsx`, `leave.tsx` |
| Audit activity | `/audit` alias and existing canonical `/settings/audit` operational view | `audit.tsx` only; no business-Settings page is owned |
| Manager report hub | `/analytics`, `/reports` redirect | `hub-analytics.tsx`, embedded `reports-index.tsx` |
| Manager reports | `/reports/sales`, `/reports/inventory`, `/reports/zreport`, `/reports/daily-operations`, `/pnl`, `/vat-report` | `reports.tsx`, `inventory-reports.tsx`, `zreport.tsx`, `daily-operations.tsx`, `pnl.tsx`, `vat-report.tsx` |
| Finance reports | `/accounting/chart-of-accounts`, `/accounting/trial-balance`, `/accounting/balance-sheet`, `/accounting/cash-flow`, `/accounting/period-close`, `/accounting/fixed-assets`, `/procurement/debit-notes` | `chart-of-accounts.tsx`, `trial-balance.tsx`, `balance-sheet.tsx`, `cash-flow-statement.tsx`, `period-close.tsx`, `fixed-assets.tsx`, `debit-notes.tsx` |

## Supporting ownership

- `src/components/shared/mobile-route-context.tsx`: active-branch and explicit online/offline local-mode context; scoped Android table cards; derived cell labels; 25-row local paging and search fallback; 44px controls; horizontal tabs; phone keyboard and safe-area handling; full-height sheet/dialog safeguards. Desktop behavior is restored above `1023px`.
- `src/components/share-doc-menu.tsx`: 44px Android PDF-share actions, local download/print while offline, and clear offline blocking for WhatsApp/email.
- `src/components/dashboard/dashboard-insights.tsx`: dashboard touch sizing and compact gutters.
- `tests/mobile-core-routes.spec.tsx`: focused ownership and Android contract checks.
- `docs/MOBILE_ROUTE_OWNERSHIP.md`: this exact manifest.

## Operational contract

- Phone is below `640px`; tablet is `640–1023px`; existing desktop composition remains at `lg` (`1024px`) and above.
- Tables without purpose-built cards are converted only below `lg` into labelled record cards. The fallback is searchable and bounded to `MOBILE_TABLE_PAGE_SIZE = 25`; existing service pagination remains authoritative where present.
- Growing product, category, employee, user, department, branch, leave-type, customer, and supplier choices use searchable comboboxes. Fixed enums retain selects.
- Empty states tell the operator how to create the missing prerequisite or clear the active search/filter.
- Existing route-level `RequireRole` gates remain intact. New dashboard/card mutation affordances use existing domain permissions; no business rule or service authorization was weakened.
- Reads and writes remain local-first. Offline context never blocks local operations. Internet-only WhatsApp/email sharing stops immediately with guidance; PDF generation, download, and print remain local.
- Money, phone examples, account currency, and tax labels/rates use the active country profile. Kenya-only VAT3/KRA actions are shown only for Kenya.

## Explicit exclusions

No files under `src/components/layout`, `src/App.tsx`, package or lock manifests, `src-tauri`, Cargo, or CI are owned. POS routes, business Settings pages, Pharmacy/Dawa, Retail/Soko, Hardware, Hospitality, Salon, and other vertical routes are not implemented by this task. Existing links to those areas are preserved but not expanded.
