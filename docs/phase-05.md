# Phase 5 — Reporting & Analytics

## Goals
- Business intelligence dashboards
- Standard pharmacy reports
- Export capabilities (PDF, CSV)
- Visual charts and trends

## Tasks

### 5.1 Dashboard (Home Screen)
Real-time summary cards:
- Today's sales (count + total)
- Today's profit (if cost data available)
- Items below reorder level
- Items expiring within 30 days
- Top selling items (today/week/month)
- Sales trend chart (7-day sparkline)

### 5.2 Sales Reports
- **Daily sales summary** — grouped by payment method
- **Sales by period** — custom date range, daily/weekly/monthly
- **Sales by product** — top sellers, slow movers
- **Sales by category** — which categories perform
- **Sales by user** — cashier performance
- **Profit report** — revenue minus cost of goods sold
- **Payment method breakdown** — cash vs M-Pesa vs credit

### 5.3 Inventory Reports
- **Stock valuation** — total value of current stock at cost + at retail
- **Stock movement history** — all movements filtered by type/product/date
- **Expiry report** — items expiring within configurable window
- **Dead stock** — items with no sales in X days
- **Reorder report** — items below reorder level with suggested quantities
- **Batch report** — all active batches with quantities and expiry

### 5.4 Pharmacy-Specific Reports
- **Controlled substances register** — daily/monthly log
- **Prescription log** — all prescriptions by date
- **Supplier purchase history** — spending by supplier
- **Purchase order status** — open/pending POs

### 5.5 Export & Print
- All reports exportable as PDF (formatted) or CSV (raw data)
- Print-optimized layouts for A4
- Scheduled report generation (daily summary auto-generated at close)

### 5.6 UI Components
- Chart library: lightweight (recharts or chart.js via react-chartjs-2)
- Date range picker for all reports
- Comparison mode (this period vs last period)
- Drill-down: click a chart segment → see underlying data

## Done When
- Dashboard shows real-time business health
- All listed reports generate correctly
- PDF export produces clean, printable documents
- CSV export works for all reports
- Charts render with correct data
- Date range filtering works across all reports
