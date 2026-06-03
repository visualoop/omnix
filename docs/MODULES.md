# Module Architecture

Omnix is a modular ERP platform. The **core** ships in every install. Each business vertical
(pharmacy, hardware store, electronics, salon, restaurant, ...) is a **module** that plugs in
on top of the core.

## What "module" means in Omnix

A module is a layered extension that:

1. Adds its own SQL tables (typically extending core tables)
2. Adds its own services in `src/services/`
3. Adds its own pages in `src/pages/`
4. Adds its own sidebar nav entries
5. **Never modifies core tables** (uses foreign keys instead)

## Current modules

### Core

Files: `migrations/001_core.sql` through `migrations/006_payments.sql`, `migrations/012_erp_extensions.sql`

Tables:
- `business`, `users`, `sessions`
- `products`, `categories`, `batches`, `stock_movements`
- `customers`, `customer_groups`, `suppliers`
- `sales`, `sale_items`, `payments`, `payment_methods`
- `purchase_orders`, `goods_receipts`
- `sale_returns`, `stock_takes`
- `expenses`, `cash_register`
- `payment_providers`, `payment_transactions`
- `etims_config`, `etims_invoices`, `hs_codes` (KRA)
- `license`, `license_activations`

### Dawa (Pharmacy)

Files: `migrations/004_pharmacy.sql`, `migrations/008_insurance.sql`, `migrations/010_interactions.sql`

Tables (extensions):
- `pharmacy_products` (extends `products`)
- `prescriptions`, `prescription_items`
- `controlled_log`
- `drug_interactions`
- `patient_profiles` (extends `customers`)
- `patient_allergies`
- `insurance_providers`, `insurance_members`, `insurance_claims`, `insurance_batches`

Services: `services/pharmacy.ts`, `services/interactions.ts`, `services/insurance.ts`

Pages: `/pharmacy`, `/pharmacy/expiry`, `/patients/:id`, `/claims`

## Adding a new module (e.g., Electronics)

1. **Create migration** `013_electronics.sql`:
   ```sql
   -- Extends products with electronics-specific fields
   CREATE TABLE electronics_products (
     product_id TEXT PRIMARY KEY REFERENCES products(id),
     model_number TEXT,
     warranty_months INTEGER,
     ...
   );

   -- Per-unit serial tracking
   CREATE TABLE serial_units (
     id TEXT PRIMARY KEY,
     product_id TEXT REFERENCES products(id),
     serial_number TEXT UNIQUE,
     imei TEXT,
     status TEXT CHECK (status IN ('in_stock', 'sold', 'returned', 'repair')),
     ...
   );
   ```

2. **Register in `src-tauri/src/lib.rs`** (add to migrations vec)

3. **Create `services/electronics.ts`** with the service layer

4. **Create pages** in `src/pages/electronics/`

5. **Add routes** in `src/App.tsx`

6. **Add sidebar entry** in `src/components/layout/sidebar.tsx`

7. **Add to modules list** in `src/pages/modules.tsx`

The module ships in the same Tauri build — no plugin runtime to manage.

## Why this isn't full plugin architecture

For a single binary running on a single device, dynamic plugin loading would add complexity
without value. Modules are compile-time extensions. If a customer doesn't need Dawa they just
won't visit `/pharmacy`. The unused tables sit empty — they cost ~0 bytes when unused in SQLite.

If module count grows beyond ~10 verticals or modules need to be sold separately, this can be
upgraded to compile-time feature flags (Cargo features + Vite build flags).

## Why pharmacy first

Pharmacy compliance in Kenya is the heaviest:
- KRA eTIMS (mandatory for VAT-registered businesses)
- SHA insurance (replaced NHIF in 2024 — affects every pharmacy)
- Drug Boards regulations (controlled substances log)
- Prescription validation
- Drug interaction checks (patient safety / liability)

Building these correctly forces the core to handle: signed external API integration, multi-party
transactions (insurance copay), regulatory reporting (VAT3 returns), audit trails, and patient
data. A retail/hardware/restaurant module then drops most of these requirements and reuses the
remaining 80% of the engine.
