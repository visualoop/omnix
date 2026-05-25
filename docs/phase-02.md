# Phase 2 — Inventory Engine

## Goals
- Product/item management (generic, not pharmacy-specific)
- Stock tracking with batches
- Categories and organization
- Barcode support
- Reorder level alerts

## Tasks

### 2.1 Database Schema (Inventory)
```sql
categories (id, name, parent_id, description, sort_order)
products (id, name, sku, barcode, category_id, unit, description, 
          reorder_level, active, created_at, updated_at)
price_lists (id, name, is_default, markup_percent)
product_prices (product_id, price_list_id, buying_price, selling_price)
batches (id, product_id, batch_number, quantity, expiry_date, 
         buying_price, received_at, supplier_id)
stock_movements (id, product_id, batch_id, type, quantity, 
                 reference_type, reference_id, notes, created_at, user_id)
```

### 2.2 Product Management
- Add/edit/deactivate products
- Bulk import from CSV
- Barcode generation and scanning
- Category tree (nested categories)
- Product images (stored locally)
- Multiple units of measure

### 2.3 Stock Tracking
- Real-time stock levels per product
- Batch-level tracking (FIFO for dispensing)
- Stock movements log (audit trail)
- Movement types: Purchase, Sale, Adjustment, Return, Transfer, Damage

### 2.4 Pricing Engine (Full Implementation)
**Database Schema:**
```sql
price_lists (id, name, is_default, markup_percent, active, created_at)
product_prices (product_id, price_list_id, buying_price, selling_price)
discount_rules (id, name, type, value, min_quantity, max_quantity,
                customer_group, product_id, category_id, 
                starts_at, ends_at, active)
customer_groups (id, name, price_list_id, discount_percent)
```

**Features:**
- Multiple price lists (Retail, Wholesale, Staff, VIP, etc.)
- Each product has a price per price list
- Default price list applied when no customer selected
- Customer linked to a group → group has assigned price list
- Markup rules: set markup % on price list, auto-calculates selling from buying price
- Per-product override: manually set selling price to override markup calculation
- Quantity discounts: buy X+ units → Y% off (configurable per product or category)
- Discount rules engine:
  - Percentage off (whole cart or specific product/category)
  - Fixed amount off
  - Min quantity trigger
  - Date-range validity (optional, for promotions)
- At POS: system resolves price by: customer group → price list → discount rules → final price
- Price history: track when prices changed (audit trail)

**Price Resolution Order (at POS):**
1. Is a customer selected? → use their group's price list
2. No customer? → use default price list
3. Check quantity discount rules
4. Apply any active discount rules (product/category/cart level)
5. Manual cashier discount (if role permits, with max % limit)

### 2.5 Tax / VAT System
```sql
tax_rates (id, name, rate_percent, is_default, active)
product_tax (product_id, tax_rate_id)
```
- Configurable tax rates (e.g., VAT 16%, Exempt 0%)
- Per-product tax assignment (some items exempt, some standard rate)
- Tax-inclusive or tax-exclusive pricing (business-level setting)
- Tax breakdown on receipts
- Tax report for filing (total collected per period)

### 2.6 Supplier Management (Core — not pharmacy-specific)
```sql
suppliers (id, name, contact_person, phone, email, address,
           payment_terms, balance_owed, notes, active, created_at)
purchase_orders (id, supplier_id, po_number, status, total_amount,
                 ordered_by, ordered_at, expected_at, received_at, notes)
po_items (id, po_id, product_id, quantity_ordered, quantity_received,
          buying_price, batch_number, expiry_date)
supplier_payments (id, supplier_id, amount, method, reference, 
                   notes, paid_at, recorded_by)
```
- Supplier directory with contact info and payment terms
- Purchase order workflow: Draft → Sent → Partial → Complete → Cancelled
- Goods receiving: match against PO, enter batches/expiry
- Supplier balance tracking (what you owe them)
- Supplier payment recording
- Purchase history per supplier

### 2.7 Customer & Credit Management
```sql
customers (id, name, phone, email, customer_group_id, 
           credit_limit, balance, notes, active, created_at)
customer_groups (id, name, price_list_id, discount_percent)
credit_transactions (id, customer_id, sale_id, type, amount, 
                     balance_after, notes, created_at, recorded_by)
```
- Customer records with contact details
- Customer groups → linked to price lists
- Credit system:
  - Credit limit per customer (configurable)
  - Block sale on credit if limit exceeded
  - Balance tracking (what they owe you)
  - Payment recording (customer pays off balance)
  - Statement generation per customer
  - Aging report (30/60/90 days overdue)
- Customer purchase history
- Quick lookup by phone number at POS

### 2.8 Alerts & Notifications
- Low stock alerts (below reorder level)
- Expiry alerts (configurable: 30/60/90 days)
- Out-of-stock items list

### 2.6 UI Screens
- **Product list** — data table with search, filter by category, stock status
- **Product detail** — slide-out panel with all info, stock history, pricing
- **Add/Edit product** — form with barcode scanner trigger
- **Stock adjustments** — quick adjustment form with reason
- **Categories** — tree view with drag-to-reorder
- **Alerts dashboard** — expiry + low stock in one view

## Done When
- Products can be created with full details
- Stock levels track correctly through movements
- Barcode scanning identifies products
- Price lists work with correct selling prices
- Expiry and low-stock alerts fire correctly
- CSV import works for bulk product loading
