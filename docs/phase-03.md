# Phase 3 — POS Engine

## Goals
- Fast, visual billing interface
- Barcode scanning integration
- Multiple payment methods (cash for now, Paystack later)
- Receipt printing
- Sale history and voids

## Tasks

### 3.1 Database Schema (Sales)
```sql
sales (id, sale_number, customer_id, user_id, device_id,
       subtotal, discount_amount, tax_amount, total,
       payment_status, status, notes, created_at)
sale_items (id, sale_id, product_id, batch_id, quantity,
            unit_price, discount, total, price_list_id)
payments (id, sale_id, method, amount, reference, 
          status, provider_ref, created_at)
customers (id, name, phone, email, type, price_list_id, 
           balance, notes, created_at)
```

### 3.2 POS Interface Design
Layout (optimized for speed + visual clarity):
```
┌─────────────────────────────────────────────────────┐
│ [Search/Scan]            [Customer ▾]    [Hold] [▪] │
├────────────────────────────┬────────────────────────┤
│                            │  Cart Items            │
│  Quick-access product      │  ─────────────────     │
│  grid (favorites/recent)   │  Item 1    qty  price  │
│                            │  Item 2    qty  price  │
│  ─────────────────────     │  Item 3    qty  price  │
│  Search results appear     │                        │
│  here when typing          │                        │
│                            │                        │
│                            ├────────────────────────┤
│                            │  Subtotal:    1,200    │
│                            │  Discount:     -100    │
│                            │  Total:       1,100    │
│                            │                        │
│                            │  [Cash] [M-Pesa] [Pay] │
└────────────────────────────┴────────────────────────┘
```

### 3.3 POS Features
- **Instant search** — type product name or scan barcode
- **Quick-access grid** — configurable favorites/frequent items
- **Cart management** — adjust qty, remove, apply line discount
- **Hold/recall** — park a sale, serve next customer, come back
- **Customer selection** — optional, links to price list
- **Payment split** — part cash, part M-Pesa
- **Receipt printing** — thermal printer (80mm) via system print
- **Keyboard shortcuts:**
  - F1: New sale
  - F2: Hold sale
  - F3: Recall held sale
  - F4: Payment
  - F8: Void last item
  - Esc: Cancel

### 3.4 Payment Methods (Flexible System)
**Pre-loaded methods:**
- **Cash** — amount tendered, change calculated
- **M-Pesa (Manual)** — record transaction code, mark paid
- **M-Pesa (Paystack)** — automated STK push (Phase 6, optional)
- **Bank Transfer** — record reference number
- **Credit/On Account** — deduct from customer balance (requires customer selected)

**Custom methods (owner-configured):**
- Owner can add unlimited custom payment methods via Settings
- Examples: "Equity Pay", "Airtel Money", "Cheque", "Card (POS Machine)"
- Each custom method captures: amount + optional reference field
- No integration needed — it's purely a record

**Split payments:**
- Any sale can be split across multiple methods
- E.g., KES 500 Cash + KES 300 M-Pesa on the same sale

### 3.5 Receipt System
- Configurable receipt template (header, footer, logo)
- Auto-print or manual print toggle
- Receipt reprint from sale history
- Digital receipt option (future: print/email)

### 3.6 Sale Management
- Sale history with search/filter
- Void/refund workflow (requires Manager+ role)
- Daily sale summary
- Shift open/close with cash count

### 3.7 Keyboard-First Design
Every action reachable without mouse. The POS must feel as fast as typing — no clicks required for a standard sale flow:
1. Scan/type → item added
2. Scan/type → second item
3. F4 → payment screen
4. Type amount → Enter → sale complete + receipt prints

## Done When
- Complete sale flow works in under 10 seconds (scan → pay → receipt)
- Barcode scanning adds items instantly
- Hold/recall works with multiple held sales
- Cash payment with change calculation
- Receipt prints correctly on thermal printer
- Sale history searchable with void capability
- Keyboard-only flow works end-to-end
