/**
 * Module catalog — seed data used until owner uploads to Payload Modules collection.
 * When CMS data exists, components prefer the CMS values via the moduleBySlug() helper.
 */

export type ModuleStatus = 'live' | 'beta' | 'planned'

export interface ModuleSeed {
  slug: string
  moduleId: string
  name: string
  shortName: string
  tagline: string
  status: ModuleStatus
  priority: number
  shortDescription: string
  longDescription?: string
  for: string[]
  features: { title: string; description: string; icon: string }[]
  compliance: string[]
  whatYouNeed: { label: string; body: string }[]
  pricing: { from: number; cadence: string; note: string }
}

export const MODULES_SEED: ModuleSeed[] = [
  {
    slug: 'core',
    moduleId: 'core',
    name: 'Core',
    shortName: 'Core',
    tagline: 'The spine of every Omnix licence.',
    status: 'live',
    priority: 0,
    shortDescription:
      'Branches, employees, banking, invoicing, KRA filings — all wired together. Always included.',
    for: [
      'Any Kenyan SME with two or more staff',
      'Single-shop businesses ready to professionalise',
      'Multi-branch operators who need consolidation',
    ],
    features: [
      {
        title: 'Multi-branch from day one',
        description:
          'Master / client topology over LAN. Each branch keeps its own till; data reconciles centrally.',
        icon: 'Building2',
      },
      {
        title: 'Employees, payroll, statutory',
        description:
          'NHIF/SHA, NSSF, PAYE batches with one click. P9, P10, KRA returns one click away.',
        icon: 'Users',
      },
      {
        title: 'Banking & reconciliation',
        description:
          'M-Pesa Till + Equity, KCB, Co-op bank statement matching. Cleared vs uncleared visible.',
        icon: 'Landmark',
      },
      {
        title: 'Invoicing + recurring',
        description:
          'B2B invoicing with KRA-aligned tax codes, recurring schedules, age-of-debt report.',
        icon: 'FileText',
      },
      {
        title: 'Reports that match the books',
        description:
          'P&L, balance sheet, cash flow — derived from the same ledger your auditor reads.',
        icon: 'BarChart3',
      },
      {
        title: 'Role-based access',
        description:
          'Owner, manager, cashier, stock keeper. Each role sees only the surfaces that apply.',
        icon: 'ShieldCheck',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt issuance',
      'KRA P9, P10 filings',
      'NHIF / SHA monthly batches',
      'NSSF Tier I + Tier II',
      'PAYE statutory batches',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For eTIMS configuration and statutory filings.' },
      { label: 'Active M-Pesa Till or Paybill', body: 'For collections + reconciliation.' },
      { label: 'Bank statement access', body: 'CSV or direct download from your bank portal.' },
    ],
    pricing: {
      from: 30000,
      cadence: 'one-time',
      note: 'Included in every Omnix licence — one KES 30,000 one-time purchase per device.',
    },
  },
  {
    slug: 'dawa',
    moduleId: 'dawa',
    name: 'Dawa Pharmacy',
    shortName: 'Dawa',
    tagline: 'Run your pharmacy. Calm and compliant.',
    status: 'live',
    priority: 1,
    shortDescription:
      'Dispensing, batches, expiries, controlled-drug ledger, NHIF/SHA & private insurance billing.',
    for: [
      'Independent retail pharmacies',
      'Pharmacy chains with central buying',
      'Hospital out-patient pharmacies',
      'Dispensaries and clinics',
    ],
    features: [
      {
        title: 'Prescription dispensing log',
        description:
          'PPB-compliant log with prescriber, drug, dose, dispenser, supervising pharmacist.',
        icon: 'ClipboardList',
      },
      {
        title: 'Batch + expiry tracking',
        description:
          'Down to unit level. WhatsApp alerts when stock crosses your reorder threshold or expiry window.',
        icon: 'PackageCheck',
      },
      {
        title: 'Controlled drugs ledger',
        description:
          'POM, S2/S3 register with running balances. Auto-tracked on every dispense.',
        icon: 'Lock',
      },
      {
        title: 'Drug interaction warnings',
        description:
          'Built-in BNF-aligned interaction matrix. Flags contra-indicated combinations at the till.',
        icon: 'AlertTriangle',
      },
      {
        title: 'Insurance billing',
        description:
          'NHIF, SHA, AAR, Jubilee, Britam, Madison + your private schemes. Claims pre-formatted.',
        icon: 'FileBarChart',
      },
      {
        title: 'Refill reminders',
        description:
          'Patient WhatsApp reminders for chronic prescriptions. Opt-in per customer.',
        icon: 'BellRing',
      },
    ],
    compliance: [
      'Pharmacy & Poisons Board (PPB) compliant dispensing log',
      'KRA eTIMS auto-receipt',
      'NHIF / SHA claim formatting',
      'KEMSA stock-format compatible',
      'Controlled-drug audit-ready register',
    ],
    whatYouNeed: [
      {
        label: 'PPB licence',
        body: 'Active PPB premises + supervising pharmacist details.',
      },
      {
        label: 'KRA PIN + eTIMS',
        body: 'For receipts. We help configure on first install.',
      },
      {
        label: 'NHIF / SHA registration',
        body: 'Your provider code + facility number for claims.',
      },
      {
        label: 'Insurance scheme codes',
        body: 'AAR, Jubilee, Britam, Madison if you bill them.',
      },
    ],
    pricing: {
      from: 30000,
      cadence: 'one-time',
      note: 'A perpetual licence for one device. Optional compliance updates are separate.',
    },
  },
  {
    slug: 'retail',
    moduleId: 'retail',
    name: 'Soko Retail',
    shortName: 'Retail',
    tagline: 'Sell faster. Reorder smarter.',
    status: 'live',
    priority: 2,
    shortDescription:
      'Barcode POS, layaway, supplier credit, multi-branch transfers, customer loyalty.',
    for: [
      'Mini-marts and supermarkets',
      'General dukas and kiosks',
      'Hardware shops and electronics',
      'Specialty retail (cosmetics, household, stationery)',
    ],
    features: [
      {
        title: 'Barcode-first POS',
        description:
          'USB scanner, phone camera, or manual SKU. Sub-300ms sale completion.',
        icon: 'ScanBarcode',
      },
      {
        title: 'Multi-branch transfers',
        description:
          'In-transit ledger so stock is never lost between branches. Variance reports automated.',
        icon: 'ArrowRightLeft',
      },
      {
        title: 'Supplier credit',
        description:
          'Track payable schedules per supplier, age the debt, pay batches via Paystack or M-Pesa.',
        icon: 'CreditCard',
      },
      {
        title: 'Customer loyalty',
        description:
          'Points-per-spend, threshold rewards, birthday vouchers. WhatsApp redemption codes.',
        icon: 'Gift',
      },
      {
        title: 'Layaway & lay-by',
        description:
          'Hold goods on partial payment with reminder schedule. KRA-compliant deposit invoicing.',
        icon: 'Hourglass',
      },
      {
        title: 'End-of-day Z-report',
        description:
          'Pre-filled Z-report with cashier reconciliation, M-Pesa till total, cash count, variance.',
        icon: 'Receipt',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt issuance',
      'KEBS standards mark recording',
      'M-Pesa Till + Paybill reconciliation',
      'KRA PAYE on sales staff statutory',
    ],
    whatYouNeed: [
      {
        label: 'KRA PIN',
        body: 'For eTIMS receipt issuance from day one.',
      },
      {
        label: 'M-Pesa Till or Paybill',
        body: 'For digital payments and reconciliation.',
      },
      {
        label: 'Barcode scanner (optional)',
        body: 'USB scanner — KES 1,500 from any local supplier. Or use phone camera.',
      },
    ],
    pricing: {
      from: 30000,
      cadence: 'one-time',
      note: 'A perpetual licence for one device. Optional compliance updates are separate.',
    },
  },
  {
    slug: 'hardware',
    moduleId: 'hardware',
    name: 'Hardware',
    shortName: 'Hardware',
    tagline: 'Heavy stock. Heavier margins.',
    status: 'live',
    priority: 3,
    shortDescription:
      'Quotations, delivery notes, contractor accounts with credit & aging, tiered pricing, commissions.',
    for: [
      'Hardware shops and timber yards',
      'Building supplies and tools',
      'Steel and aluminium dealers',
    ],
    features: [
      {
        title: 'Quotations → sale',
        description: 'Build a quote, send it, convert it to a sale in one click when the customer commits.',
        icon: 'FileText',
      },
      {
        title: 'Delivery notes',
        description: 'Dispatch slip with vehicle + driver, mark dispatched and delivered.',
        icon: 'Truck',
      },
      {
        title: 'Contractor accounts',
        description: 'Credit limits, running balance, aged receivables (current / 30 / 60 / 90+).',
        icon: 'CreditCard',
      },
      {
        title: 'Tiered / contractor pricing',
        description: 'Per-customer price lists so contractors and walk-ins see the right price.',
        icon: 'Ruler',
      },
      {
        title: 'Sales commissions',
        description: 'Commission rules per salesperson, accrued automatically on each sale.',
        icon: 'Percent',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt',
      'KEBS import standards mark',
      'M-Pesa Till + Paybill reconciliation',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For receipts and statutory.' },
      { label: 'M-Pesa Till or Paybill', body: 'For collections and reconciliation.' },
      { label: 'Customer list', body: 'Contractor accounts and credit terms.' },
    ],
    pricing: {
      from: 30000,
      cadence: 'one-time',
      note: 'A perpetual licence for one device. Optional compliance updates are separate.',
    },
  },
  {
    slug: 'hospitality',
    moduleId: 'hospitality',
    name: 'Hospitality',
    shortName: 'Hospitality',
    tagline: 'Tables to kitchen. Rooms to folio.',
    status: 'live',
    priority: 4,
    shortDescription:
      'Restaurant POS, kitchen display, service charge & tips, rooms, bookings, folios, recipe costing.',
    for: [
      'Restaurants, cafes and bars',
      'Hotels and guest houses',
      'Lodges with rooms + dining',
    ],
    features: [
      {
        title: 'Table floor plan & orders',
        description: 'Per-area tables, open an order, send to kitchen, track through to served.',
        icon: 'Grid3x3',
      },
      {
        title: 'Kitchen display',
        description: 'Orders grouped by station with bump from preparing → ready → served.',
        icon: 'ChefHat',
      },
      {
        title: 'Service charge & tips',
        description: 'Configurable service charge plus tips allocated to staff, separate from revenue.',
        icon: 'Percent',
      },
      {
        title: 'Rooms & bookings',
        description: 'Room types, bookings, check-in assigns a room and opens a folio.',
        icon: 'BedDouble',
      },
      {
        title: 'Folios & check-out',
        description: 'Post restaurant/bar charges to the room; check-out requires a settled balance.',
        icon: 'FileText',
      },
      {
        title: 'Recipes & reports',
        description: 'Recipe costing with food-cost %, occupancy, ADR and RevPAR dashboards.',
        icon: 'BarChart3',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt',
      'SHA on staff',
      'County health licence reminders',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For receipts and statutory.' },
      { label: 'Kitchen thermal printer', body: 'USB or LAN Epson-compatible (optional).' },
      { label: 'Menu + rooms', body: 'Menu items, prices, and room inventory.' },
    ],
    pricing: {
      from: 30000,
      cadence: 'one-time',
      note: 'A perpetual licence for one device. Optional compliance updates are separate.',
    },
  },
  {
    slug: 'salon',
    moduleId: 'salon',
    name: 'Salon & Spa',
    shortName: 'Salon',
    tagline: 'Appointments to commissions. One calm diary.',
    status: 'live',
    priority: 5,
    shortDescription:
      'Appointment diary, staff skills & commissions, packages & memberships, back-bar stock, client history.',
    for: [
      'Hair salons and barbershops',
      'Nail bars and beauty parlours',
      'Spas and wellness studios',
    ],
    features: [
      {
        title: 'Appointment diary',
        description: 'Day + week views by staff, tap-to-book, automatic clash detection so nobody is double-booked.',
        icon: 'Calendar',
      },
      {
        title: 'Staff skills & commissions',
        description: 'Assign services per stylist; commission accrues automatically at checkout.',
        icon: 'Percent',
      },
      {
        title: 'Packages & memberships',
        description: 'Sell prepaid session bundles; sessions redeem themselves at checkout.',
        icon: 'Ticket',
      },
      {
        title: 'Back-bar + client history',
        description: 'Products used deduct from stock; every client keeps formulas, preferences and past visits.',
        icon: 'Sparkles',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt',
      'M-Pesa Till + Paybill reconciliation',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For receipts and statutory.' },
      { label: 'M-Pesa Till or Paybill', body: 'For collections and reconciliation.' },
      { label: 'Service menu + staff', body: 'Services, durations, prices and your team.' },
    ],
    pricing: {
      from: 30000,
      cadence: 'one-time',
      note: 'A perpetual licence for one device. Optional compliance updates are separate.',
    },
  },
]

export function moduleBySlug(slug: string): ModuleSeed | null {
  return MODULES_SEED.find((m) => m.slug === slug) ?? null
}

export function moduleSlugs(): string[] {
  return MODULES_SEED.map((m) => m.slug)
}
