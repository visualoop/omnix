# Core Modules — Omnix ERP Platform

## Shared Core (Every Business Type Gets These)

### 1. POS / Sales Engine
- Cart-based selling with search + barcode scan
- Configurable quick-access product grid
- Hold/recall multiple sales
- Split payments across methods
- Receipt printing (thermal + A4)
- Sale history, voids, refunds
- Shift open/close with cash count
- **Module hooks:** before-add, after-sale, extra fields, warnings

### 2. Inventory Engine
- Products with SKU, barcode, categories
- Batch tracking with expiry dates
- Stock movements (purchase, sale, adjustment, damage, transfer)
- Reorder levels and alerts
- CSV bulk import/export
- Product images
- Unit of measure management

### 3. Purchasing / Suppliers
- Supplier directory
- Purchase order creation and tracking
- Goods receiving (match PO, enter batch/expiry)
- Supplier payment tracking
- Purchase history and spending reports

### 4. Customer Management
- Customer records (name, phone, email, type)
- Customer balance / credit system
- Purchase history per customer
- Customer groups (for pricing)
- Quick customer lookup at POS

### 5. Pricing Engine
- Multiple price lists (Retail, Wholesale, VIP, etc.)
- Customer-group pricing rules
- Per-product override prices
- Markup percentage rules
- Quantity-based discounts (buy 10+ get X% off)

### 6. Payment Methods (Flexible)
- **Pre-loaded:** Cash, M-Pesa (Manual), Bank Transfer, Credit/On Account
- **Optional integration:** Paystack (M-Pesa STK push, Cards)
- **Custom methods:** Owner creates any payment method (Equity Pay, Airtel Money, Cheque, Card Machine, etc.)
- Each method records: amount, reference, verification status
- Split payments: combine any methods on one sale
- Reconciliation: match recorded payments against actuals

### 7. Users & Roles
- Role-based access: Owner, Manager, Cashier, Viewer
- Per-role permissions (what can they see/do)
- PIN-based quick switching (busy POS)
- Activity audit log per user
- Session management and auto-lock

### 8. Reports & Analytics
- Dashboard with live KPIs
- Sales reports (by period, product, category, user, payment method)
- Inventory reports (valuation, movement, expiry, dead stock)
- Purchase reports (spending by supplier, outstanding POs)
- Profit reports (revenue - COGS)
- Custom date ranges + export (PDF, CSV)

### 9. Settings & Configuration
- Business profile (name, logo, address, contact)
- Receipt template configuration
- Tax settings (VAT rate, tax ID, include/exclude)
- Printer setup
- Backup schedule
- Theme (dark/light/system)
- Display density (comfortable/compact)

### 10. Backup & Data
- One-click manual backup (encrypted SQLite export)
- Scheduled auto-backup (configurable frequency + location)
- Restore from backup
- Full data export (CSV for migration)
- Audit log (all sensitive operations)

---

## Industry Module System

Industry modules **extend** the core — they don't replace it.

### How Modules Hook Into Core

```
Core POS Engine
│
├── onProductSearch(query) 
│   └── Module can add extra search fields/filters
│
├── onBeforeAddToCart(product, quantity)
│   └── Module can block (e.g., "requires prescription") or add prompts
│
├── onCartItemRender(item)
│   └── Module can add warnings, badges, extra info to cart display
│
├── extraSaleFields()
│   └── Module can add fields to the sale (e.g., patient name, table number)
│
├── onAfterSale(sale)
│   └── Module can trigger post-sale actions (log, print label, send to kitchen)
│
├── receiptExtras(sale)
│   └── Module can add lines to receipt (dosage, loyalty points earned)
│
├── productFormExtras()
│   └── Module adds fields to product creation (generic name, strength, etc.)
│
└── dashboardWidgets()
    └── Module adds cards to dashboard (expiry alerts, pending prescriptions)
```

### Module: Dawa (Pharmacy) — First Release
- Prescription management
- Controlled substance tracking
- Drug interaction warnings (basic)
- Expiry-first dispensing (FIFO enforcement)
- Dosage label printing
- Pharmacy compliance reports
- Generic/brand name tracking
- Storage condition flags

### Module: Rejareja (Retail) — Future
- Product variants (size, color, material)
- Promotions engine (BOGO, % off, bundles)
- Loyalty points system
- Barcode label printing
- Seasonal pricing
- Returns/exchanges workflow

### Module: Chakula (Restaurant/Food) — Future
- Table management
- Kitchen display system (orders sent to kitchen)
- Menu modifiers (extra cheese, no onions)
- Split bills by seat
- Tips tracking
- Course timing (starter, main, dessert)

### Module: Karakana (Workshop/Service) — Future
- Job cards / work orders
- Labor hour tracking
- Service history per customer/vehicle
- Parts used per job
- Warranty tracking
- Quote → Invoice workflow

### Module: Jumla (Wholesale/Distribution) — Future
- Route-based sales
- Bulk/tiered pricing
- Credit terms per customer (30/60/90 days)
- Delivery scheduling
- Salesperson commission tracking
- Outstanding invoice management
