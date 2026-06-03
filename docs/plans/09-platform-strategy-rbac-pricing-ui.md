# 09 - Platform Strategy: Granular RBAC, Modules, Pricing, Competition, and UI Quality

**Goal:** Turn Omnix into a defensible Kenyan SME ERP platform, not just a set of POS screens. This plan covers granular roles/permissions, module boundaries, recommended verticals, pricing strategy, competitive positioning, customer-facing display quality, and UI/design workflow.

This is a planning document only. No implementation should begin until this is reviewed against `07-system-integration-stabilization.md` because RBAC, settings, modules, customer display, and pricing all touch the same architecture.

## 1. Product direction

Omnix should not be sold as a cheap generic POS. Kenya already has many generic POS products. The stronger position is:

> Offline-first Kenyan vertical ERP for owner-operated SMEs that need POS, inventory, compliance, staff controls, branch control, and local workflows without depending on internet uptime.

Core differentiators:
- Works offline for core operations.
- Kenyan compliance first: KRA/eTIMS, VAT, SHA/insurance where relevant, Kenya payroll rules.
- Local payment reality: cash, M-Pesa manual, M-Pesa STK, bank, card machine, credit/on-account.
- Vertical modules are serious, not cosmetic skins.
- Owner controls data locally.
- Granular access controls for fraud reduction.
- Branch/device licensing that still works in unreliable network environments.

## 2. Current pricing document conflict

`docs/pricing-and-business.md` is now behind the product.

It currently says:
- Target only single-location pharmacies.
- Not targeting chains.
- HR/payroll, multi-branch, loyalty, stock transfers are removed from launch.
- One-time KES 30,000 license + KES 12,000/year maintenance.

But the current repo and plans already include:
- Multi-branch infrastructure.
- HR/payroll.
- Retail module.
- Hospitality module plan.
- eTIMS, insurance, stock transfers, banking, invoicing, recurring invoices, tips.

Decision: rewrite pricing around platform + modules, while keeping the trust advantage of offline ownership.

## 3. Market research summary, May 2026

Observed Kenyan market signals:

- PharmaSync publicly positions as pharmacy ERP with M-Pesa, eTIMS, SHA, prescriptions, staff/payroll, accounting, loyalty, and multi-branch on higher tier. Public pricing shown: Starter KES 2,999/month, Professional KES 5,499/month, Enterprise custom. Their pricing page also references KES 9,999/month in a current crawl, so pricing may be actively changing.
- DineHQ positions restaurant POS for Kenya with M-Pesa STK, KRA ETR-ready receipts, 30-day free trial, no setup fees, and per-day style price framing.
- Bizflow positions as offline-first restaurant POS with no monthly fee/free period messaging.
- Hotel360 positions as complete hospitality management across POS, inventory, accommodation, services, payroll, analytics, recipe/production management.
- ModernPOS Kenya pricing guide frames restaurant/hotel POS software around roughly KES 40,000-80,000, while ERP packages can be much higher.
- Generic cloud ERP/POS competitors sell broad access and dashboards, but offline reliability and data ownership are still a gap.

Implication: Omnix cannot win by being merely cheaper. It should win by being more local, more offline-resilient, more vertical, and more owner-control/fraud-control focused.

## 4. Recommended pricing model

Keep the rule from AGENTS.md: no Standard/Pro/Enterprise tiers. Use a single base license with paid modules/devices/services. Do not create feature-denial tiers.

### Recommended structure

Base license:
- Omnix Core: KES 45,000 one-time per business, includes 1 active device and first year maintenance.
- Annual maintenance: KES 18,000/year per business.
- Additional device: KES 12,000 one-time per device.
- Annual device maintenance: KES 3,000/year per extra device.

Vertical modules:
- Dawa module: KES 25,000 one-time + KES 12,000/year compliance maintenance.
- Retail module: KES 15,000 one-time + KES 6,000/year maintenance.
- Hospitality module: KES 35,000 one-time + KES 18,000/year maintenance.
- Hardware/Workshop module: KES 20,000 one-time + KES 8,000/year maintenance.

Optional services:
- On-site installation/training in Nairobi: KES 10,000-20,000 depending on distance/time.
- Data migration beyond clean CSV: KES 5,000-25,000.
- Custom receipt/invoice template: KES 5,000.
- Extra branch setup/training: KES 10,000 per branch.
- Priority support retainer: KES 3,000-7,500/month for businesses that want guaranteed response.

Launch offers:
- First 10 customers: 30% off license, no discount on maintenance.
- Referral: maintenance credit, not cash discount.
- Trial: 7-14 days, local install, watermarked reports if needed. Avoid long free trials.

Why this beats pure monthly SaaS:
- Lower 3-year cost than KES 5,499/month pharmacy SaaS.
- Still gives recurring revenue through maintenance.
- Keeps trust: software keeps working if maintenance lapses, but compliance updates/support stop.
- Modules let serious businesses pay more without fragmenting the base product into artificial tiers.

### Example bundles

Pharmacy single device:
- Core KES 45,000 + Dawa KES 25,000 = KES 70,000 first year.
- Renewal: KES 30,000/year.

Retail single device:
- Core KES 45,000 + Retail KES 15,000 = KES 60,000 first year.
- Renewal: KES 24,000/year.

Restaurant/cafe single device:
- Core KES 45,000 + Hospitality KES 35,000 = KES 80,000 first year.
- Renewal: KES 36,000/year.

Small hotel with 3 devices:
- Core KES 45,000 + Hospitality KES 35,000 + 2 extra devices KES 24,000 = KES 104,000 first year.
- Renewal: KES 42,000/year.

Guardrail: if this feels too high for the first customers, discount the first-year license only. Do not train the market to expect cheap support.

## 5. Module portfolio strategy for Kenya

### Already planned or implemented

1. Core ERP - must be excellent everywhere.
2. Dawa Pharmacy - high compliance, high willingness to pay.
3. Retail - large market, useful for dukas, cosmetics, minimarts, boutiques.
4. Hospitality - restaurants, bars, cafes, guest houses, lodges, small hotels.

### Recommended next modules

#### Hardware / Building Materials
Why it is worth it:
- Many Kenyan towns have hardware shops with serious inventory value.
- They need quotations, contractor pricing, credit, delivery notes, stock control, and multi-unit sales.
- Less regulated than pharmacy, but high cash leakage risk.

Must include:
- Contractor/customer price lists.
- Quotations to invoice/sale.
- Delivery notes.
- Bulk UOMs: pieces, bags, lengths, sheets, cartons.
- Project/customer account tracking.
- Credit limits and aging.
- Salesperson commissions.

#### Services / Workshop / Repair
Useful for:
- Phone repair, electronics repair, motorbike garages, appliance repair, small workshops.

Must include:
- Job cards.
- Deposits.
- Parts used.
- Labor charges.
- Warranty on repair.
- Customer communication log.
- Technician assignment.

#### Salon / Spa / Barber
Useful but likely lower ticket than pharmacy/hospitality/hardware.

Must include:
- Appointments.
- Service menu and durations.
- Staff commissions.
- Packages/memberships.
- Product retail add-on.

#### Wholesale / Distribution
High value but operationally more complex.

Must include:
- Sales routes.
- Van stock.
- Credit terms.
- Delivery/dispatch.
- Bulk pricing.
- Salesperson collections.
- Aged receivables.

Recommended order after Hospitality:
1. Hardware.
2. Workshop/Repair.
3. Wholesale/Distribution.
4. Salon/Spa.

Reasoning: hardware and workshop deepen invoicing, quotations, credit, delivery, and job costing, which strengthen Core for all modules.

## 6. Granular RBAC model

The current four fixed roles are not enough. The product needs custom roles, groups, permissions, branch scope, module scope, and action-level checks.

### Concepts

User:
- Someone who can log in.
- Has authentication, PIN/2FA, active status, branch access.

Employee:
- Someone the business employs/pays/schedules.
- May or may not have a user login.

Role:
- Named permission bundle.
- Examples: Owner, Branch Manager, Senior Cashier, Cashier, Pharmacist, Stock Controller, Accountant, Waiter, Kitchen, Reception, Housekeeping.

Group:
- Collection of users for bulk assignment.
- Examples: Nairobi Branch Cashiers, Pharmacists, Kitchen Staff, Housekeepers, Accounts Team.

Permission:
- Atomic ability to view, create, update, delete, approve, void, export, print, configure, or override.

Scope:
- Where permission applies: all branches, assigned branches, one branch, own records, own shift, own orders, own patients, own tables.

Policy/override:
- Additional condition such as max discount percent, max refund amount, can sell below cost, can reopen closed shift, can backdate transactions.

### Schema direction

Replace fixed-only role logic with tables:

```sql
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
    key TEXT PRIMARY KEY,
    module_id TEXT NOT NULL DEFAULT 'core',
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'normal'
      CHECK (risk_level IN ('low','normal','high','critical'))
);

CREATE TABLE role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
    PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    branch_id TEXT REFERENCES branches(id),
    module_id TEXT,
    PRIMARY KEY (user_id, role_id, branch_id, module_id)
);

CREATE TABLE group_roles (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    branch_id TEXT REFERENCES branches(id),
    module_id TEXT,
    PRIMARY KEY (group_id, role_id, branch_id, module_id)
);

CREATE TABLE permission_overrides (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('user','group','role')),
    subject_id TEXT NOT NULL,
    permission_key TEXT NOT NULL REFERENCES permissions(key),
    effect TEXT NOT NULL CHECK (effect IN ('allow','deny')),
    branch_id TEXT REFERENCES branches(id),
    module_id TEXT,
    reason TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Keep `users.role` temporarily for migration/backward compatibility, then move to dynamic role resolution.

### Permission naming convention

Use `module.resource.action`.

Core examples:
- `core.pos.open`
- `core.pos.sell`
- `core.sales.view`
- `core.sales.discount.apply`
- `core.sales.discount.override_limit`
- `core.sales.void`
- `core.sales.refund`
- `core.sales.refund_without_receipt`
- `core.sales.reprint_receipt`
- `core.inventory.view`
- `core.inventory.create`
- `core.inventory.update`
- `core.inventory.delete`
- `core.inventory.adjust_stock`
- `core.inventory.view_cost`
- `core.purchases.create_po`
- `core.purchases.receive_goods`
- `core.customers.view`
- `core.customers.edit`
- `core.customers.credit.approve`
- `core.reports.view`
- `core.reports.export`
- `core.settings.manage_business`
- `core.settings.manage_branches`
- `core.settings.manage_users`
- `core.settings.manage_roles`
- `core.audit.view`

Dawa examples:
- `dawa.prescriptions.create`
- `dawa.prescriptions.dispense`
- `dawa.controlled.view`
- `dawa.controlled.dispense`
- `dawa.controlled.adjust`
- `dawa.insurance.claims.create`
- `dawa.insurance.claims.submit`
- `dawa.clinical.override_interaction`
- `dawa.pharmacist.on_duty`

Retail examples:
- `retail.variants.manage`
- `retail.price_lists.manage`
- `retail.laybys.create`
- `retail.laybys.cancel`
- `retail.shrinkage.record`
- `retail.shrinkage.approve`

Hospitality examples:
- `hospitality.orders.take`
- `hospitality.orders.send_kitchen`
- `hospitality.orders.void`
- `hospitality.bills.split`
- `hospitality.bills.service_charge.override`
- `hospitality.tables.move`
- `hospitality.kitchen.bump`
- `hospitality.bookings.manage`
- `hospitality.checkin.manage`
- `hospitality.folios.post_charge`
- `hospitality.folios.close`
- `hospitality.housekeeping.update_status`

### UI for roles and groups

Settings routes:
- `/settings/users`
- `/settings/roles`
- `/settings/groups`
- `/settings/access-audit`

Role builder:
- Table grouped by module/resource/action.
- Search permissions.
- Risk badges: low, normal, high, critical.
- Preset role templates per module.
- Clone system role to custom role.
- Compare two roles.
- Show affected users/groups.

Group builder:
- Add users to group.
- Assign role to group per branch/module.
- Show effective permissions for a selected user.

Effective access viewer:
- Select user.
- Shows direct roles + group roles + branch access + overrides.
- Explains why a permission is allowed/denied.

Runtime:
- Frontend gates UI for convenience.
- Backend/Tauri command layer must enforce critical permissions before DB mutation.
- Audit every high/critical permission action.

## 7. Core vs module-specific rulebook

Core should own anything every SME needs:
- POS payment engine.
- Inventory and stock movements.
- Customers/suppliers.
- Purchases/GRN.
- Returns/refunds.
- Branches.
- Users, roles, groups, audit.
- Reports framework.
- Tax/payment/settings framework.
- Backup/license/network/update.
- Employees/payroll as a platform capability.

Modules should own vertical nouns and workflows:
- Dawa: prescriptions, patients, controlled substances, clinical warnings, claims.
- Retail: variants, laybys, special orders, shrinkage specifics.
- Hospitality: tables, kitchen, rooms, bookings, folios, recipes, service charge.
- Hardware: contractor pricing, project sales, delivery notes, material units.
- Workshop: job cards, technician work, warranties.

Rule: if a feature makes sense for any business, it is Core. If it only makes sense in one industry, it is module-specific. If it starts in a module but becomes useful everywhere, promote it into Core deliberately.

## 8. Customer-facing display redesign plan

Current issue:
- `src/pages/customer-display.tsx` uses large gradients and hardcoded module color decisions.
- It does not look like a premium customer display.
- It has no real module contract for what customer-facing content should show.
- It cannot scale cleanly to Dawa, Retail, Hospitality, Hardware, etc.

### Design direction

Make it calm, branded, legible from a distance, and module-aware.

Do not use:
- Loud gradients as the main visual language.
- Random green/orange/purple skins.
- Generic decorative blobs.
- Dense admin UI on customer screen.

Use:
- Flat dark or light display theme with strong contrast.
- Business logo/name and active module mark.
- Large totals.
- Clear line items.
- Optional promotional panel controlled from Settings.
- Module-specific content slots.

### Customer display contract

Create a module display registry:

```ts
interface CustomerDisplayModuleConfig {
  moduleId: ModuleId;
  accent: string;
  idleTitle: string;
  idleSubtitle: string;
  activeLabels: {
    orderTitle: string;
    totalLabel: string;
  };
  lineMetadata?: (item: CartItem) => DisplayLineMeta[];
  idlePanel?: ReactNode;
  paymentSuccessPanel?: ReactNode;
}
```

Dawa display:
- Avoid exposing private patient/clinical data.
- Show item names only if configured; pharmacy may want privacy mode.
- Optional message: "Please confirm your items with the pharmacist."

Retail display:
- Show item images/variants if available.
- Show loyalty points estimate if customer selected.
- Show promotions applied.

Hospitality display:
- Show table/order number or room charge status.
- Show service charge/tip separately.
- For restaurant, show "Sent to kitchen" / "Bill" context if applicable.

Hardware display:
- Show quotation/invoice/customer account balance where relevant.

### Settings for display

Add `/settings/customer-display` under Core settings:
- Theme: system, dark, light.
- Accent source: business accent, module accent, custom.
- Idle screen message.
- Privacy mode for product names.
- Show tax breakdown on/off.
- Show loyalty/promotions on/off.
- Show customer name on/off.
- Fullscreen default.
- Test display button.

### Build quality checks

- Use Playwright screenshots for 1280x720, 1024x768, and 1920x1080.
- Verify no text overlap.
- Verify totals readable at distance.
- Verify Dawa privacy mode.
- Verify module switching changes labels/content without garish recoloring.

## 9. UI skills and design workflow

Research summary:
- OpenAI's Codex app skills catalog includes skills for implementing designs from Figma, generating images, deploying apps, and using official docs.
- The OpenAI skills repo is the canonical Codex skill catalog.
- Anthropic's `frontend-design` skill is widely referenced for avoiding generic AI UI and pushing production-quality React/Tailwind interfaces.
- Third-party skill directories list Anthropic `frontend-design`, frontend skill packs, and UI/UX skill variants, but third-party skills need review before installation.

Recommendation:

1. Install/use official or high-trust skills only.
2. Prefer a custom repo-local Omnix design skill over stacking many random third-party skills.
3. Create `docs/ui-design-reference.md` as the source of truth, then make a Codex skill from it if needed.
4. Use screenshot-based verification, not vibes.

Suggested skill stack:
- Existing `imagegen` skill for generating module/customer-display visual assets when useful.
- Official/open-source frontend design skill only after reviewing its contents.
- Custom `omnix-ui-quality` skill for this repo, containing:
  - Linear/Notion-grade desktop rules.
  - No gradients/orbs/slop rule.
  - Settings shell pattern.
  - Data table density rules.
  - Customer-display design rules.
  - Module-specific color/theming contract.
  - Playwright screenshot checklist.

Do not install a skill just because it is popular. Install only if it improves repeatable implementation quality.

## 10. Launch strategy

Launch sequence should avoid trying to sell every module at once.

Recommended public launch package:

1. Core + Dawa for pharmacies.
2. Core + Retail for dukas/cosmetics/minimarts.
3. Core + Hospitality beta for restaurants/cafes after POS/cart/payment stabilization.

Why:
- Dawa has compliance urgency and higher willingness to pay.
- Retail proves platform breadth.
- Hospitality is attractive but operationally complex; launch it only after POS state is rock solid.

Sales wedge:
- "Own your system. Keep selling offline. Stay compliant. Control every staff action."

Proof points needed before public launch:
- Payment completion never leaves stale cart.
- Returns always correct profit.
- Branch reports are correct.
- Roles can restrict risky actions.
- Customer display looks premium.
- Settings are clean and module-aware.

## 11. Implementation batches

### Batch 1 - Plan reconciliation
- Rewrite `docs/pricing-and-business.md` to match platform + modules.
- Update `docs/MODULES.md` with Hospitality, Hardware, Workshop, Wholesale, Salon order.
- Update `docs/core-modules.md` to replace fixed roles with granular RBAC direction.

### Batch 2 - Dynamic RBAC schema and service
- Add roles/permissions/groups/user_roles/group_roles/overrides migrations.
- Seed current owner/manager/cashier/viewer as system roles.
- Seed permission catalog from current `src/lib/permissions.ts` plus module permissions.
- Add effective permission resolver.

### Batch 3 - RBAC UI
- Settings role builder.
- Settings group builder.
- Effective access viewer.
- User profile access tab.
- Employee link integration from plan 07.

### Batch 4 - Runtime enforcement
- Replace static permission matrix with dynamic resolver.
- Keep cached permission snapshot in auth store.
- Add backend enforcement for high-risk commands.
- Audit critical actions.

### Batch 5 - Customer display redesign
- Add display registry.
- Add settings page.
- Redesign idle/active/success states.
- Add module display configs for Core, Dawa, Retail, Hospitality placeholder.
- Add screenshot checks.

### Batch 6 - Pricing and launch collateral
- Update pricing docs and website plan.
- Add comparison pages for pharmacy/retail/hospitality.
- Build ROI calculator based on expired stock, leakage, subscription savings, compliance risk.

### Batch 7 - Skill/design process
- Review frontend design skill contents before installing.
- Create repo-local Omnix UI quality skill if useful.
- Add Playwright visual acceptance scripts for key screens.

## 12. Definition of done

- Roles are custom, granular, and group-aware.
- Permissions are module/resource/action based.
- Users can receive roles directly or through groups.
- Access can be scoped by branch and module.
- Employees remain separate from users but can be linked.
- Module-specific settings do not leak across modules.
- Pricing supports Core + paid modules without Standard/Pro/Enterprise tiers.
- Customer display is themeable, module-aware, and premium-looking.
- Launch positioning is based on offline reliability, Kenyan compliance, staff control, and vertical depth.
