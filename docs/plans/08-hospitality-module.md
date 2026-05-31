# 08 - Hospitality Module Plan

**Goal:** Add a Hospitality module for Kenyan restaurants, cafes, bars, hotels, lodges, guest houses, and mixed restaurant-hotel businesses without contaminating Dawa or Retail settings.

This is a vertical module like Dawa and Retail. Core ERP remains shared. Hospitality owns dining, kitchen, room, booking, folio, service charge, and hospitality-specific tax/levy behavior.

## Target users

- Restaurants and cafes
- Bars and lounges
- Hotel restaurants
- Guest houses and lodges
- Small hotels with 5-80 rooms
- Mixed businesses: restaurant + rooms + retail counter
- Caterers who need event orders and deposits

## What belongs in Core vs Hospitality

| Concept | Core | Hospitality |
|---|---|---|
| Users, roles, branches | Yes | Uses Core |
| Employees, payroll, attendance | Yes | Adds shifts/tips/service allocation |
| Inventory and purchasing | Yes | Adds recipes, ingredients, wastage, menu costing |
| POS payments, cash register | Yes | Adds table orders, tabs, split bills, room charge |
| Customers | Yes | Adds guests, booking history, folios |
| Reports and P&L | Yes | Adds occupancy, RevPAR, covers, food cost, kitchen waste |
| Taxes | Yes | Adds catering/tourism/service levy settings where applicable |
| Dawa prescriptions/insurance | No | Never |
| Retail variants/laybys | No | Shared only when business activates Retail separately |

## Module identity

- Module ID: `hospitality`
- Display name: `Soko Hospitality`
- Short name: `Hospitality`
- Primary workflows: Restaurant POS, kitchen orders, table management, rooms and bookings, guest folios, menu costing.
- Suggested accent: deep green or burgundy, but keep the global one-accent rule configurable.

## Module settings boundary

Hospitality settings appear only when active module is `hospitality`.

Settings routes:
- `/settings/hospitality`
- `/settings/hospitality/tables`
- `/settings/hospitality/kitchen`
- `/settings/hospitality/rooms`
- `/settings/hospitality/booking`
- `/settings/hospitality/service-charge`
- `/settings/hospitality/taxes`
- `/settings/hospitality/receipt`

Settings sections:
- Dining areas and tables
- Kitchen stations and printers
- Menu categories and modifiers
- Room types and rate plans
- Booking policies
- Check-in/check-out times
- Service charge rules
- Hospitality taxes/levies
- Folio and invoice templates

Must not appear in Dawa or Retail:
- Table maps
- Rooms
- Guest folios
- Kitchen displays
- Recipe costing
- Booking policies
- Service charge pooling

## Roles and permissions

Extend permissions only when the module is enabled:

- `hospitality.tables.view`
- `hospitality.tables.manage`
- `hospitality.orders.take`
- `hospitality.orders.send_kitchen`
- `hospitality.orders.void`
- `hospitality.kitchen.view`
- `hospitality.kitchen.bump`
- `hospitality.bookings.view`
- `hospitality.bookings.manage`
- `hospitality.checkin.manage`
- `hospitality.folios.manage`
- `hospitality.menu.manage`
- `hospitality.recipes.manage`
- `hospitality.rates.manage`
- `hospitality.housekeeping.view`
- `hospitality.housekeeping.manage`
- `hospitality.reports.view`
- `hospitality.service_charge.manage`

Suggested role mapping:

| Role | Access |
|---|---|
| Owner | Everything |
| Manager | tables, orders, kitchen, bookings, check-in/out, reports, menu, housekeeping |
| Cashier | take orders, receive payments, split bills, room charge, basic booking lookup |
| Viewer | reports and read-only bookings |

Hospitality staff should still be employees:
- Waiters, cooks, housekeepers, receptionists, bartenders, supervisors are `employees`.
- Login access is optional through `employees.user_id`.
- Tips and service charge allocation should point to `employees.id`.

## Restaurant scope

### Dining model

Schema:

```sql
CREATE TABLE dining_areas (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dining_tables (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    area_id TEXT REFERENCES dining_areas(id),
    table_code TEXT NOT NULL,
    name TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 2,
    x REAL,
    y REAL,
    status TEXT NOT NULL DEFAULT 'available'
      CHECK (status IN ('available','occupied','reserved','cleaning','inactive')),
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(branch_id, table_code)
);
```

Pages:
- `/hospitality/tables` - floor plan and table list
- `/hospitality/orders` - active orders/tabs
- `/hospitality/kitchen` - kitchen display

Behavior:
- Select table before dine-in order.
- Support takeaway and delivery orders without table.
- Multiple open orders per table only with manager permission.
- Move table, merge table, split table.
- Transfer waiter.
- Hold/reopen order.

### Menu and modifiers

Hospitality can reuse Core `products` for sellable menu items but needs menu-specific metadata.

Schema:

```sql
CREATE TABLE menu_items (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    branch_id TEXT REFERENCES branches(id),
    menu_name TEXT NOT NULL,
    category TEXT,
    station_id TEXT,
    prep_minutes INTEGER,
    dine_in_price REAL,
    takeaway_price REAL,
    delivery_price REAL,
    active INTEGER NOT NULL DEFAULT 1,
    available_from TEXT,
    available_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE menu_modifiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single','multiple')),
    required INTEGER NOT NULL DEFAULT 0,
    min_select INTEGER NOT NULL DEFAULT 0,
    max_select INTEGER,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE menu_modifier_options (
    id TEXT PRIMARY KEY,
    modifier_id TEXT NOT NULL REFERENCES menu_modifiers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_delta REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_item_modifiers (
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
    modifier_id TEXT NOT NULL REFERENCES menu_modifiers(id),
    PRIMARY KEY (menu_item_id, modifier_id)
);
```

Examples:
- Tea: sugar/no sugar, milk/black
- Pizza: size, toppings
- Steak: doneness, side
- Chips: plain/masala, sauce
- Breakfast: eggs style

### Kitchen orders

Schema:

```sql
CREATE TABLE kitchen_stations (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    printer_name TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE hospitality_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    table_id TEXT REFERENCES dining_tables(id),
    customer_id TEXT REFERENCES customers(id),
    guest_id TEXT,
    order_type TEXT NOT NULL CHECK (order_type IN ('dine_in','takeaway','delivery','room_service')),
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','sent','preparing','ready','served','paid','voided')),
    waiter_id TEXT REFERENCES employees(id),
    opened_by TEXT NOT NULL REFERENCES users(id),
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    notes TEXT
);

CREATE TABLE hospitality_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES hospitality_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    menu_item_id TEXT REFERENCES menu_items(id),
    station_id TEXT REFERENCES kitchen_stations(id),
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    modifier_total REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new','sent','preparing','ready','served','voided')),
    notes TEXT,
    sent_at TEXT,
    ready_at TEXT,
    served_at TEXT
);

CREATE TABLE hospitality_order_item_modifiers (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL REFERENCES hospitality_order_items(id) ON DELETE CASCADE,
    modifier_name TEXT NOT NULL,
    option_name TEXT NOT NULL,
    price_delta REAL NOT NULL DEFAULT 0
);
```

Kitchen behavior:
- Send only unsent items to kitchen.
- Print kitchen tickets by station.
- Kitchen display groups by station and order age.
- Bump item/order from preparing to ready.
- Waiter marks served.
- Voids require reason and permission.

### Restaurant POS

Adjust existing POS rather than creating a totally separate payment engine.

Restaurant mode needs:
- Table selector/floor plan before order.
- Order type selector: dine-in, takeaway, delivery, room service.
- Menu grid by category.
- Modifier sheet before adding item.
- Split bill by item, by seat, or amount.
- Merge bills.
- Tips and service charge.
- Room charge to guest folio.
- Kitchen ticket after send.

Rules:
- An order can be open without payment.
- A Core sale is created only when payment is completed or when charged to room/folio.
- Kitchen order items must not disappear after sale completion; they remain operational history.
- Inventory ingredient deduction can happen on order paid or kitchen sent. For v1, use paid to avoid stock drift from voids.

## Hotel scope

### Rooms and rates

Schema:

```sql
CREATE TABLE room_types (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    description TEXT,
    base_occupancy INTEGER NOT NULL DEFAULT 1,
    max_occupancy INTEGER NOT NULL DEFAULT 2,
    base_rate REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    room_type_id TEXT NOT NULL REFERENCES room_types(id),
    room_number TEXT NOT NULL,
    floor TEXT,
    status TEXT NOT NULL DEFAULT 'available'
      CHECK (status IN ('available','occupied','reserved','dirty','maintenance','out_of_order')),
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(branch_id, room_number)
);

CREATE TABLE rate_plans (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    room_type_id TEXT NOT NULL REFERENCES room_types(id),
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    meal_plan TEXT CHECK (meal_plan IN ('room_only','bed_breakfast','half_board','full_board')),
    starts_at TEXT,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1
);
```

Pages:
- `/hospitality/rooms` - room board
- `/hospitality/bookings` - reservation list/calendar
- `/hospitality/checkin` - arrivals/departures
- `/hospitality/housekeeping` - room status board

### Guests, bookings, folios

Use Core `customers` where possible, but guests need stay-specific fields.

Schema:

```sql
CREATE TABLE guests (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_number TEXT,
    nationality TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    booking_number TEXT UNIQUE NOT NULL,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    guest_id TEXT NOT NULL REFERENCES guests(id),
    room_id TEXT REFERENCES rooms(id),
    room_type_id TEXT NOT NULL REFERENCES room_types(id),
    rate_plan_id TEXT REFERENCES rate_plans(id),
    check_in_date TEXT NOT NULL,
    check_out_date TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'reserved'
      CHECK (status IN ('reserved','checked_in','checked_out','cancelled','no_show')),
    rate_per_night REAL NOT NULL,
    deposit_amount REAL NOT NULL DEFAULT 0,
    source TEXT,
    notes TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE guest_folios (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    folio_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','voided')),
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
);

CREATE TABLE folio_charges (
    id TEXT PRIMARY KEY,
    folio_id TEXT NOT NULL REFERENCES guest_folios(id) ON DELETE CASCADE,
    charge_type TEXT NOT NULL CHECK (charge_type IN ('room','restaurant','bar','laundry','service','tax','adjustment')),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0,
    source_sale_id TEXT REFERENCES sales(id),
    source_order_id TEXT REFERENCES hospitality_orders(id),
    posted_by TEXT NOT NULL REFERENCES users(id),
    posted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE folio_payments (
    id TEXT PRIMARY KEY,
    folio_id TEXT NOT NULL REFERENCES guest_folios(id),
    payment_id TEXT,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    paid_by TEXT NOT NULL REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Booking behavior:
- Booking reserves a room type; room assignment can happen later.
- Check-in assigns room and opens folio.
- Night audit posts room charges.
- Restaurant/bar order can charge to room if booking is checked in.
- Checkout requires folio balance zero or manager override.
- Room moves preserve folio.
- No-show and cancellation record reason and optional charge.

## Recipes and inventory costing

Hospitality inventory needs ingredient-level costing, not just selling finished products.

Schema:

```sql
CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
    yield_quantity REAL NOT NULL DEFAULT 1,
    instructions TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    wastage_percent REAL NOT NULL DEFAULT 0
);

CREATE TABLE hospitality_wastage (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('prep_waste','spoilage','burnt','breakage','staff_meal','comped')),
    cost_value REAL,
    user_id TEXT NOT NULL REFERENCES users(id),
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
);
```

Reports:
- Menu item gross margin.
- Food cost percentage.
- Wastage by reason.
- Ingredient usage variance.
- Stock needed for bookings/events.

v1 rule:
- Add recipe costing UI and reports.
- Defer automatic ingredient deduction until restaurant order lifecycle is stable, unless the product already maps one-to-one to stock.

## Service charge and tips

Existing tips migration (`024_tips.sql`) links sales tips to employees. Hospitality needs a broader service-charge model.

Schema:

```sql
CREATE TABLE service_charge_rules (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id),
    name TEXT NOT NULL,
    percent REAL NOT NULL,
    applies_to TEXT NOT NULL CHECK (applies_to IN ('dine_in','room_service','all')),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE service_charge_allocations (
    id TEXT PRIMARY KEY,
    sale_id TEXT REFERENCES sales(id),
    order_id TEXT REFERENCES hospitality_orders(id),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    amount REAL NOT NULL,
    allocation_method TEXT NOT NULL CHECK (allocation_method IN ('waiter','pool','manual')),
    payroll_period TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Rules:
- Tips are voluntary.
- Service charge is configured by business policy.
- Both must be separated from product revenue in reports.
- Payroll can include tips/service charge payouts by employee.

## Reports

Restaurant:
- Sales by menu category
- Covers by hour
- Average ticket
- Table turnover
- Open orders
- Kitchen prep time
- Void/comp report
- Food cost percentage
- Wastage report
- Waiter sales and tips

Hotel:
- Occupancy percentage
- ADR: average daily rate
- RevPAR: revenue per available room
- Arrivals and departures
- No-shows and cancellations
- Housekeeping status
- Folio balances
- Revenue by charge type
- Room revenue vs restaurant revenue

Branch-aware:
- All reports filter by active branch by default.
- Owner/manager can select all branches.

## Hardware and printing

Shared:
- Receipt printer
- Cash drawer
- Barcode scanner

Hospitality-specific:
- Kitchen printer per station
- Bar printer
- Kitchen display screen
- Customer bill printer
- Optional waiter tablet over LAN later

Printing templates:
- Kitchen order ticket
- Customer bill before payment
- Fiscal receipt/tax invoice after payment
- Guest registration card
- Booking confirmation
- Folio statement
- Housekeeping task sheet

## Pages

Under `/hospitality`:

1. `/hospitality/dashboard`
2. `/hospitality/tables`
3. `/hospitality/orders`
4. `/hospitality/kitchen`
5. `/hospitality/menu`
6. `/hospitality/recipes`
7. `/hospitality/bookings`
8. `/hospitality/rooms`
9. `/hospitality/checkin`
10. `/hospitality/housekeeping`
11. `/hospitality/folios`
12. `/hospitality/wastage`
13. `/hospitality/reports`

Settings under `/settings/hospitality/*`, not under the operational sidebar.

## POS integration

Do not fork all POS logic. Create a mode layer:

- Core payment engine stays in `src/services/sales.ts`.
- Hospitality order lifecycle lives in `src/services/hospitality.ts`.
- Restaurant POS view adapts item selection, modifiers, tables, and split billing.
- Payment completion creates Core sale and links back to hospitality order/folio.

Cart extensions needed:
- `orderType`
- `tableId`
- `waiterId`
- `covers`
- `modifiers`
- `seatNumber`
- `course`
- `folioId` for room charge

These should not leak into Dawa/Retail POS unless inactive/null.

## Migrations

Use the next available migration number after current latest (`024_tips.sql` at time of planning).

Suggested sequence:

1. `025_hospitality_core.sql` - dining areas/tables, kitchen stations, menu items/modifiers.
2. `026_hospitality_orders.sql` - hospitality orders/items/modifier selections, sale/order linking columns if needed.
3. `027_hospitality_rooms.sql` - room types, rooms, rate plans, guests, bookings.
4. `028_hospitality_folios.sql` - folios, charges, folio payments.
5. `029_hospitality_recipes.sql` - recipes, ingredients, wastage.
6. `030_hospitality_service_charge.sql` - service charge rules and allocation.

## Build order

### Batch 1 - Module registration and settings shell
- Add `hospitality` to module definitions.
- Add feature ownership in `src/lib/module-features.ts`.
- Add permissions in `src/lib/permissions.ts`.
- Add module logo.
- Add settings registry entries.
- Add placeholder settings page.

### Batch 2 - Restaurant foundation
- Migration for dining areas/tables, kitchen stations, menu items.
- Services for tables and menu.
- Settings pages for dining areas, tables, kitchen stations.
- Operational table board page.

### Batch 3 - Restaurant order lifecycle
- Hospitality orders and order items.
- Restaurant POS table/order mode.
- Send to kitchen.
- Kitchen display page.
- Void/comp reason capture.

### Batch 4 - Payment, split bill, service charge
- Link hospitality order to Core sale.
- Split bill by item/seat/amount.
- Tips and service charge integration.
- Customer bill and kitchen ticket printing.

### Batch 5 - Rooms and bookings
- Rooms, room types, rate plans.
- Booking calendar/list.
- Check-in/check-out basics.
- Housekeeping status board.

### Batch 6 - Folios and room charge
- Guest folios.
- Post room charges.
- Charge restaurant/bar order to room.
- Folio payment and statement.

### Batch 7 - Recipes and costing
- Recipe builder.
- Ingredient cost calculations.
- Wastage recording.
- Menu margin report.

### Batch 8 - Hospitality reports
- Restaurant dashboard.
- Hotel dashboard.
- Occupancy, ADR, RevPAR.
- Covers, average ticket, table turnover.
- Service charge/tips report.

## Out of scope for v1

- Online booking engine.
- Channel manager integrations.
- OTA integrations like Booking.com or Airbnb.
- Door lock integration.
- Full property-management enterprise features.
- Waiter mobile app.
- Delivery marketplace integrations.
- Complex banquet/event management.

## Acceptance criteria

- Hospitality pages appear only when active module is Hospitality.
- Hospitality settings appear only under Settings, not in Dawa or Retail.
- Restaurant can open a table order, send items to kitchen, split bill, pay, and close table.
- Hotel can create booking, check in, post room charge, charge restaurant order to room, and check out with zero balance.
- Tips/service charge are separated from product revenue.
- Reports are branch-aware.
- Employees are used for waiters, kitchen staff, reception, housekeeping, and service allocation.
- Core sale/payment/accounting remains the financial source of truth.
