# 07 - System Integration Stabilization

**Goal:** Fix the places where shipped modules do not behave as one system: Settings navigation, module-aware settings ownership, POS cart state, payment completion, returns/profit, user-employee linking, and multi-location visibility.

This plan exists because the current app has many good individual features, but several relationships are not enforced end to end. The priority is not adding more pages. The priority is making the existing Core, Dawa, Retail, HR, Branches, Sales, Reports, and Settings surfaces agree with each other.

## Current repo findings

### Settings
- `src/pages/settings.tsx` is a single business profile page plus a list of configuration links.
- Routes are flat in `src/App.tsx`; settings children are not rendered inside a dedicated settings layout.
- `src/pages/settings.tsx` links to `/settings/branches`, `/settings/payments`, `/settings/etims`, `/settings/insurance`, `/settings/users`, `/settings/network`, `/settings/modules`, `/settings/backup`, `/audit`, and `/settings/license`.
- The main app sidebar still shows `Users` and `Audit Log` as top-level pages even though they also belong inside admin/settings.
- `src/components/layout/sidebar.tsx` currently uses `nav` without `overflow-auto`, so long navigation can hide lower items.
- `src/lib/module-features.ts` already has route ownership for Dawa and Retail, but settings links are not grouped or hidden by module ownership.

### Multi-location
- `src-tauri/migrations/016_branches.sql` has branches, user-branch assignments, branch IDs on transactional tables, and stock transfers.
- `src/services/branches.ts`, `src/pages/branches.tsx`, `src/stores/active-branch.ts`, and `src/components/layout/branch-switcher.tsx` already exist.
- `src/components/layout/topbar.tsx` already mounts `BranchSwitcher`.
- The issue is discoverability and consistency: branches exist, but settings needs to make them first-class and all reports/actions must respect active branch.

### POS cart
- `src/pages/pos.tsx` subscribes to the entire cart store with `useCartStore()`, then also separately subscribes to `customerId` and `tip`.
- `src/stores/cart.ts` persists cart state and broadcasts every cart change with a 50ms debounce for the customer display window.
- Cart methods update state, but do not broadcast immediately on critical actions like `clear`.
- Quantity multiplier logic in `src/pages/pos.tsx` watches `items.length`, then mutates the last line through `updateQty`; this is fragile when clicking products quickly or when an existing product line is incremented instead of adding a new line.
- The pack/carton barcode path reads "last item" after `addItem`, which can update the wrong line when the product already exists.

### Payment completion
- `src/components/pos/payment-modal.tsx` calls `completeSale(...)`, starts receipt printing with a timeout, calls `clear()`, then immediately `onClose()`.
- Because cart persistence and Tauri window broadcast are async/debounced, the UI can close before all windows observe the cleared state.
- The modal derives `total` from `grandTotal()` on every render and resets `amount` when `[open, total]` changes. This can interfere with tip/payment rows if cart state changes while modal is open.

### Returns and profit
- `src/services/accounting.ts#getPnL` only reads `payments` joined to `sales` where `sales.status = 'completed'`.
- It does not subtract `sale_returns.refund_amount`.
- It does not reduce COGS by returned quantities.
- Any dashboard/report using sales totals without return offsets can continue showing false profit after refunds.

### Users and employees
- `src-tauri/migrations/017_hr.sql` correctly separates users from employees and has `employees.user_id`.
- `src/services/employees.ts` already reads and writes `user_id`.
- `src/pages/employees.tsx` does not yet expose a complete user-linking workflow.
- `src/pages/users.tsx` already has branch assignment UI. The missing relationship is employee -> system user -> branch/role.

## Settings model

Settings should become a small app inside the app. When the user enters Settings, the main operational sidebar should disappear and a settings sidebar should appear. A back button returns to the previous operational screen or dashboard.

### Settings layout

Create `src/components/layout/settings-layout.tsx`.

Behavior:
- Left settings sidebar, fixed width about 220px.
- Header row with back button, current section title, optional description.
- Main pane renders the selected page.
- Sidebar uses `overflow-auto`.
- No modal dialogs for settings data entry; keep existing sheets/panels.
- Route active state uses `NavLink`.
- Back button uses `navigate(-1)` when there is history, otherwise `/`.

Routes:
- `/settings` -> Business Profile
- `/settings/branches` -> Locations & Branches
- `/settings/users` -> Users & Permissions
- `/settings/roles` -> Role Matrix, even if initially read-only
- `/settings/payments` -> Payment Methods
- `/settings/taxes` -> VAT, tax categories, receipt/tax invoice defaults
- `/settings/etims` -> KRA eTIMS
- `/settings/network` -> LAN Multi-device
- `/settings/modules` -> Modules
- `/settings/backup` -> Backup & Restore
- `/settings/audit` -> Audit Log
- `/settings/license` -> License
- `/settings/updates` -> Software Updates / autostart
- `/settings/insurance` -> Dawa-only insurance settings
- `/settings/pharmacy` -> Dawa-only clinical/compliance settings
- `/settings/retail` -> Retail-only defaults
- `/settings/hospitality` -> Hospitality-only defaults, when module ships

### Settings ownership

Use this taxonomy:

| Group | Always visible? | Examples |
|---|---:|---|
| Business | Yes | business profile, branches, receipt header, tax PIN |
| Access | Yes | users, roles, permissions, branch assignment |
| Finance | Yes | payment methods, taxes, eTIMS, banking defaults |
| Operations | Yes | backup, network, audit, license, updates |
| Dawa | Only `activeModule === "dawa"` | insurance, pharmacists, controlled substances, cold chain, clinical rules |
| Retail | Only `activeModule === "retail"` | variants, price lists, shrinkage reasons, layby defaults |
| Hospitality | Only `activeModule === "hospitality"` | tables, rooms, service charge, kitchen, booking policies |

Rules:
- Pharmacy settings must never appear in Retail or Hospitality unless they are cross-module Core settings.
- Retail settings must never appear in Dawa.
- Hospitality settings must never appear in Dawa or Retail.
- Core settings should remain in Settings for all modules.
- Module-specific operational pages can remain in their module sidebar group, but module configuration belongs in Settings.

Implementation:
- Extend `src/lib/module-features.ts` so settings routes can also be module-owned.
- Add a `settingsSections` registry in a new `src/lib/settings-registry.ts`.
- Each section declares `to`, `label`, `description`, `icon`, `permission`, `ownerModule?: ModuleId`, and `group`.
- `SettingsLayout` filters sections by permission and active module.

## Roles and relationships

The app needs two layers:

1. **Role**: what a login can do.
2. **Employee record**: who the business employs, pays, schedules, and reports on.

Do not merge them. Link them.

### Role model

Keep the existing four roles for v1:
- `owner`
- `manager`
- `cashier`
- `viewer`

Add a role matrix/settings screen that shows permissions by role. It can be read-only first. Later it can support custom roles.

Role rules:
- Owner can manage users, roles, license, network, payroll, branches, and module activation.
- Manager can run operations, see reports, manage inventory, approve leave, and view payroll, but should not manage owner-level admin.
- Cashier can sell, handle assigned returns only if allowed, clock in/out, and request leave.
- Viewer is read-only.

### Employee-user linking

Add the missing workflow to `src/pages/employees.tsx`.

Employee form:
- Field: "System user account".
- Options:
  - No login access.
  - Existing users not linked to another employee.
  - The current linked user if editing.
- Show user role and branch access beside selected user.
- Button: "Create login for employee".

Create-login flow:
- Opens a sheet, not a modal dialog.
- Pre-fills full name, phone/email, and suggested username from employee.
- Requires role and temporary password.
- Creates the user, links `employees.user_id`, then optionally opens the user branch checklist.

User form:
- Show linked employee if present.
- Warn before deleting/deactivating a user linked to an active employee.
- Branch assignment remains on user because access belongs to login, not employee.

Reporting:
- Salesperson commissions should use `sales.salesperson_id` pointing to `employees.id`, not `users.id`.
- Audit log should still use `users.id` because it records system actions.

## POS stabilization plan

### Root causes to address

- Too-broad cart subscription in `src/pages/pos.tsx`.
- Derived methods like `grandTotal()` and `subtotal()` are functions from Zustand state, causing the page to re-render and recalculate broadly.
- Debounced broadcast in `src/stores/cart.ts` can replay stale cart to other windows after `clear`.
- Product add flows rely on "last cart item", which is wrong for existing lines.
- Payment modal resets amount from changing `total` while open.

### Required changes

Cart store:
- Use atomic updater functions only: `set((state) => nextState)`.
- Make `addItem` return enough information to know whether it created or incremented a line. If the public API cannot return values cleanly, add `addItemWithQuantity(product, quantity)`.
- Add `replaceCart(snapshot)` for held-sale restore and customer display sync.
- Add `clearAndBroadcast()` or make `clear()` flush broadcast immediately.
- Prevent Tauri listener from re-emitting incoming payloads.
- Version cart payloads with `updatedAt` or `revision` so stale broadcasts cannot overwrite newer local state.

POS page:
- Replace `const { ... } = useCartStore()` with small selectors and `useShallow`.
- Move cart line rows to a memoized component.
- Use stable callbacks for add, remove, quantity update, and discount/tip open.
- Remove the `items.length` effect for quantity multiplier. Apply multiplier inside the add action itself.
- Stop reading the last cart item after barcode UOM add. Add the exact quantity in one cart operation.

Payment modal:
- Capture a payment snapshot when opening: items, customerId, discount, tip, total.
- Complete sale from that immutable snapshot.
- Do not recalculate `total` while the modal is open except when explicitly reopening.
- After `completeSale` succeeds: clear the cart synchronously, flush customer display broadcast, reset local payment rows, close modal, print receipt from sale ID.
- Disable duplicate completion while `processing`.

Acceptance tests:
- Clicking the same product three times produces one cart line with quantity 3.
- Pressing `+` increments exactly once and does not flash or reset tip/discount.
- Deleting a line removes it immediately and does not come back.
- Applying a tip persists through payment and is stored on sale.
- Completing a sale empties POS cart and customer display cart.
- Held sale restore still works.

## Returns and profit stabilization

Returns must be treated as financial events, not just stock movements.

### P&L changes

Update `src/services/accounting.ts#getPnL`:
- Gross sales: completed sale payments in period.
- Returns/refunds: sum `sale_returns.refund_amount` in period.
- Net sales: gross sales minus returns.
- Gross COGS: cost of completed sale items.
- Returned COGS: cost of returned items.
- Net COGS: gross COGS minus returned COGS.
- Gross profit: net sales minus net COGS.

P&L UI:
- Show returns as a visible line item, not a silent subtraction.
- Use labels: Gross Sales, Sales Returns, Net Sales, COGS, Returned COGS, Net COGS, Gross Profit.

### Reports to audit

Audit and fix every report that sums sales:
- Dashboard KPIs in `src/services/reports.ts`
- Daily Z-report in `src/services/z-report.ts`
- Sales reports in `src/pages/reports.tsx` and service functions behind it
- Branch stats in `src/services/branches.ts`
- Retail dashboard and retail reports
- Tips report, ensuring tips are not counted as product revenue

Rules:
- Refunds reduce net revenue.
- Returned item cost reduces net COGS.
- A fully refunded sale should not contribute positive profit.
- Partial returns reduce only the returned quantity and refunded amount.
- Inventory restock from return should already be handled by returns service; verify branch-specific stock is restored to the correct branch.

Acceptance tests:
- Sale: item sold for KES 1,000, cost KES 600. Profit = KES 400.
- Full return: net sales = 0, net COGS = 0, profit = 0.
- Partial return of half quantity: net sales = 500, net COGS = 300, profit = 200.
- Return in a later period appears in the later period as negative revenue/COGS adjustment.

## Multi-location completion

Branches are implemented but must be made visible and consistently enforced.

Settings:
- Put "Locations & Branches" first under Business settings.
- Include active branch count in the section description if cheap to load.
- Add branch settings to command palette.

Topbar:
- Keep `BranchSwitcher`, but make current branch visible enough that the user knows what branch they are operating in.
- If user has one branch, show compact branch name or hide switcher based on screen width. Do not make multi-location feel missing.

Branch enforcement:
- All create operations that produce business records must use `getActiveBranchId()` unless truly global.
- All reports must support active branch filtering and optionally "All branches" for owners/managers.
- Users can only switch into branches assigned through `user_branches`.
- Setup wizard should create initial branch details instead of generic "Main Branch".

Audit list:
- Sales, returns, expenses, cash register, petty cash, purchases, stock takes, batches, customer/supplier payments, invoices, recurring invoices, banking transactions, retail laybys, shrinkage, special orders, cold-chain records.

## Implementation batches

### Batch 1 - Settings shell
- Add `SettingsLayout`.
- Move settings route tree under the layout.
- Add `settings-registry`.
- Move Audit to `/settings/audit` while keeping `/audit` redirect or compatibility route.
- Make settings sidebar scrollable.
- Make main app sidebar scrollable.

### Batch 2 - Module-aware settings
- Filter settings sections by active module and permission.
- Add Dawa, Retail, and future Hospitality section buckets.
- Move Insurance under Dawa settings only.
- Add module settings placeholders where pages are not implemented yet.

### Batch 3 - POS state correctness
- Narrow Zustand selectors.
- Add cart revisioning and immediate clear broadcast.
- Replace last-item logic with atomic add-with-quantity.
- Memoize cart line components and stable callbacks.

### Batch 4 - Payment completion
- Snapshot cart when payment opens.
- Complete sale from snapshot.
- Clear cart, local payment state, and customer display in deterministic order.
- Add duplicate-submit guard.

### Batch 5 - Returns/reporting
- Add returns lines to P&L data type and UI.
- Update dashboard/report services to use net sales and net profit.
- Verify returned COGS and branch behavior.

### Batch 6 - User-employee relationship
- Add available-users query.
- Add employee form link field.
- Add create-login-from-employee sheet.
- Show linked employee on user management.
- Add guard/warning for linked active employees.

### Batch 7 - Branch completion pass
- Settings discoverability.
- Setup wizard branch capture.
- Branch filter audit across services.
- Command palette entries.

### Batch 8 - Regression tests
- Component tests for POS cart operations.
- Service tests for P&L with full and partial returns.
- Integration test notes for payment completion and cart clearing.
- Manual checklist covering Dawa, Retail, and Core active modules.

## Definition of done

- Settings opens with its own sidebar and back button.
- Core settings remain visible in all modules.
- Dawa settings are visible only in Dawa.
- Retail settings are visible only in Retail.
- Hospitality settings are ready to plug in without leaking into other modules.
- POS cart changes are immediate and do not undo themselves.
- Payment success always clears the cart.
- Returns reduce profit everywhere they should.
- Employees can be linked to users and users can be assigned to branches.
- Branches are visible in Settings and active branch context is respected by reports and transactions.
