# Cleanup Plan — schema bugs, native form elements, missing UX surfaces

Triggered after the prescription dispense failed with `no such column:
selling_price`. The user pointed out: the migration that moved
`selling_price` from `products` to `product_prices` left stale queries
behind; native `<select>` is still used in many places where shadcn
`<Select>` should be; the new search Combobox isn't used everywhere it
should be (patient / contractor / customer search); the pharmacy
module has no Patients tab.

## What `scripts/audit-codebase.mjs` reports right now

```
2 errors (run-time SQL bugs — block features today)
37 warnings (mostly native <select> instead of shadcn <Select>)
44 info (native <textarea>, <input type="checkbox">)
```

### Errors (must-fix; both already patched in this branch)

| File | What broke | Status |
|---|---|---|
| `src/services/pharmacy.ts` `prescriptionToCart` | Queries `products.selling_price` — sqlite errors out, dispense crashes | ✅ fixed |
| `src/components/inventory/bulk-edit-dialog.tsx` markup action | Updates `products.selling_price` — bulk markup crashes | ✅ fixed |

### Warnings (UX consistency — needs rewrites)

37 files use native `<select>`. Highest priority because they look out
of place in shadcn-styled dialogs and they don't honour the touch
density tokens we just rolled out. Concretely:

```
src/pages/doctors.tsx               specialty                   ✅ fixed
src/pages/employees.tsx             gender, user_id, department_id
src/pages/banking.tsx               account_type
src/pages/banking-detail.tsx        transaction_type, payment_method, toAccountId
src/pages/claims.tsx                providerFilter, providerId
src/pages/cloud-backup.tsx          intervalHours
src/pages/expenses.tsx              account selection
src/pages/payroll.tsx               period, employee scope
src/pages/leave.tsx                 type
src/pages/promotions.tsx            type
src/pages/purchase-orders.tsx       supplier, status filter
src/pages/quick-add.tsx             unit, tax_rate
src/pages/users.tsx                 role, branch
src/pages/invoicing.tsx             status, customer
src/pages/login.tsx                 branch
src/pages/patient-profile.tsx       blood_group
src/pages/setup.tsx                 multiple
src/pages/promotions.tsx            type
src/components/hospitality/compact-form-dialog.tsx
src/components/inventory/bulk-edit-dialog.tsx   category
src/components/inventory/product-panel.tsx      brand, unit_of_sale
src/components/pos/tip-dialog.tsx               employeeId
```

### Info (low priority — keep working, polish later)

- 28 native `<textarea>` — should use a shadcn `<Textarea>` primitive.
  We don't yet have one; add it under `components/ui/textarea.tsx`.
- 9 native `<input type="checkbox">` — should use shadcn `<Checkbox>`
  primitive. Same — add it.

## Missing UX surfaces

### Pharmacy → Patients tab

The pharmacy hub at `pages/hub-modules.tsx` `PharmacyHubPage` is missing
a Patients tab. Today the only patient surface is the detail page
`pages/patient-profile.tsx` and you can only reach it by navigating to
a known patient id. The tab should give:

- A table of every patient with search (name / national_id / phone)
- "Add patient" action
- Row click → patient-profile detail
- Surface counts: active prescriptions, last visit, allergies

### Search Combobox not used where lookups happen

The new `<Combobox>` component (search + create + keyboard nav) is the
right pattern for any "find an existing X or create a new one" flow.
Places that use a plain input or native select today and should adopt
it:

- **Patient search** — dispensing, refills, patient picker on POS
- **Doctor search** — prescription start, refills
- **Customer search** — POS, retail laybys, special orders, invoice
  new, recurring invoices
- **Contractor search** — hardware accounts
- **Supplier search** — purchase orders, receive stock (already done in
  the receive-stock-dialog rewrite — extend to PO)
- **Product search** — dispense add line, layby add line, special
  order add line (these mostly use a custom search input; the
  Combobox would standardise them)

## Phased execution

### Phase A — block the bleeding (done)
- Fix `pharmacy.ts` dispense query → join `product_prices`
- Fix `bulk-edit-dialog.tsx` markup → update `product_prices`

### Phase B — primitives (1 file each)
1. `components/ui/textarea.tsx` — shadcn-style textarea with the density tokens we just established (`touch:min-h-24` etc.)
2. `components/ui/checkbox.tsx` — shadcn-style checkbox via base-ui or radix
3. Extend `components/ui/combobox.tsx` with an `EntityCombobox` wrapper that takes `kind: 'patient' | 'doctor' | 'customer' | 'supplier' | 'contractor'`, debounces the search, and shows a "+ Add new" affordance that opens the create dialog inline

### Phase C — schema-safe queries (audit + sweep)
1. Re-run `audit-codebase.mjs` to confirm zero `error` findings
2. Add the script to CI: `node scripts/audit-codebase.mjs --fail`
3. Extend the audit script to also flag:
   - `INSERT INTO products (… buying_price/selling_price …)` — should go to `product_prices`
   - `SELECT … FROM products` that returns `unit_price` or `price` aliased from `selling_price` (catch sneaky variants)
   - Stale `tax_rate` queries (column may have moved too)

### Phase D — native form sweep (ordered by user impact)
Apply `<Select>`, `<Textarea>`, `<Checkbox>` per the audit list. One PR
per logical area:
1. Pharmacy + clinical (doctors ✅, patient-profile, refills, claims)
2. POS + cart dialogs (tip, promo, payment, dose-calculator)
3. Inventory (bulk-edit, product-panel, variants, import)
4. Finance (banking, banking-detail, expenses, invoicing, payroll, recurring-invoices)
5. HR + access (employees, leave, users, login, setup)
6. Hospitality + hardware (compact-form-dialog, quotations, PO)
7. Marketing site (`website/src/components/marketing/contact-form.tsx`, dashboard forms)

### Phase E — Pharmacy → Patients tab
1. Create `pages/patients.tsx` (list with Table + AdminSearch + AdminPagination, "Add patient" dialog)
2. Wire to `PharmacyHubPage` between Dispense and Doctors
3. Patient row links to `/pharmacy/patients/[id]` (alias of existing patient-profile)
4. Inline create dialog so dispense flow can add a new patient without leaving

### Phase F — Combobox integration
Replace plain inputs + native selects with `<EntityCombobox>` in:
- Dispense start (patient + doctor pickers)
- Refills (patient picker)
- POS customer attach
- Retail laybys (customer)
- Retail special orders (customer)
- Invoice new (customer)
- Hardware accounts (contractor)
- Purchase orders (supplier)

### Phase G — Tests + CI
- Add `tests/ui/schema-stale.spec.ts` that runs the audit script and
  asserts zero errors (regression guard).
- Add `tests/ui/native-form.spec.tsx` that asserts < 5 native `<select>`
  remaining and zero `<textarea>` outside the textarea primitive
  itself.
- Track totals over time so PRs that re-introduce native elements get
  flagged.

## Execution order this session

User said "write a comprehensive plan to fix everything first". I'll
execute in this order; each numbered item is committed separately:

1. ✅ Audit script + plan doc (this commit)
2. ✅ Fix the 2 SQL errors (already in this branch)
3. ✅ Doctor specialty native-select → shadcn Select
4. Build `Textarea` + `Checkbox` primitives
5. Build `EntityCombobox` (patient/doctor/customer/supplier/contractor)
6. Build Patients tab inside pharmacy hub + Patients list page + Add Patient dialog
7. Sweep all pharmacy native selects/textareas + wire `EntityCombobox` everywhere a patient or doctor is picked
8. Sweep top-impact native selects in POS + inventory dialogs
9. Add audit script as CI gate (zero errors required to merge)
10. Test, commit, push

Steps 4–8 ship in a single feature branch so they go to prod together
(otherwise inconsistent UI shows up while the rollout is in progress).

## What's *not* in scope this round

- Hospitality module's contact-list / customer surface — not yet built
- Website marketing forms — separate codebase rhythm, lower urgency
- Replacing `<textarea>` everywhere — covered in Phase D step 7 by area, not session-1 priority
- Snapshot-testing every dialog — addressed in Phase G with the audit script gate instead
