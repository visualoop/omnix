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
    name: 'Core ERP',
    shortName: 'Core',
    tagline: 'The spine of every Duka licence.',
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
      from: 100000,
      cadence: 'one-time',
      note: 'Included in every Duka licence.',
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
      from: 100000,
      cadence: 'one-time',
      note: 'Included in Starter or Business licence.',
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
      from: 100000,
      cadence: 'one-time',
      note: 'Included in Starter or Business licence.',
    },
  },
  {
    slug: 'salon',
    moduleId: 'salon',
    name: 'Salon & Beauty',
    shortName: 'Salon',
    tagline: 'Run the chair. Pay the stylists.',
    status: 'planned',
    priority: 3,
    shortDescription:
      'Appointment book, stylist commissions, retail sales, products vs services tracking.',
    for: [
      'Salons and barber shops',
      'Spa and beauty parlours',
      'Independent stylists and braiders',
    ],
    features: [
      {
        title: 'Appointment book',
        description: 'Drag-and-drop calendar per stylist. WhatsApp reminders to clients.',
        icon: 'Calendar',
      },
      {
        title: 'Stylist commissions',
        description: 'Per-service or per-product commission rules. Auto-feeds payroll.',
        icon: 'Percent',
      },
      {
        title: 'Products vs services',
        description: 'Track retail sales separately from service revenue. VAT applied correctly.',
        icon: 'Sparkles',
      },
      {
        title: 'Loyalty & memberships',
        description: 'Frequent-client discounts and pre-paid membership packages.',
        icon: 'Crown',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt issuance',
      'NHIF / SHA on sales staff',
      'M-Pesa Till reconciliation',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For statutory + receipts.' },
      { label: 'M-Pesa Till', body: 'For client payments.' },
      { label: 'Stylist roster', body: 'Names, ID numbers, commission rates.' },
    ],
    pricing: {
      from: 100000,
      cadence: 'one-time',
      note: 'Available with Business licence when shipped (Q3 2026).',
    },
  },
  {
    slug: 'restaurant',
    moduleId: 'restaurant',
    name: 'Restaurant',
    shortName: 'Restaurant',
    tagline: 'KOT to plate. Plate to till.',
    status: 'planned',
    priority: 4,
    shortDescription:
      'KOT printing, table layout, course timing, split bills, ingredient depletion.',
    for: [
      'Cafes and quick-service restaurants',
      'Sit-down restaurants and bistros',
      'Fast-casual chains',
    ],
    features: [
      {
        title: 'KOT to kitchen printer',
        description: 'Auto-print Kitchen Order Tickets to thermal printers per station.',
        icon: 'ChefHat',
      },
      {
        title: 'Table layout',
        description: 'Drag-and-drop floor plan, table status, server assignment.',
        icon: 'Grid3x3',
      },
      {
        title: 'Recipe + ingredient depletion',
        description: 'Each plate sold deducts ingredients per recipe.',
        icon: 'Soup',
      },
      {
        title: 'Split bills',
        description: 'By person, by item, or evenly. Print or M-Pesa per share.',
        icon: 'Split',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt',
      'PHIM / SHA on staff',
      'County health licence reminders',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For receipts and statutory.' },
      { label: 'Kitchen thermal printer', body: 'USB or LAN Epson-compatible.' },
      { label: 'Menu + recipes', body: 'Items, prices, ingredient breakdowns.' },
    ],
    pricing: {
      from: 100000,
      cadence: 'one-time',
      note: 'Available with Business licence when shipped (Q4 2026).',
    },
  },
  {
    slug: 'hardware',
    moduleId: 'hardware',
    name: 'Hardware',
    shortName: 'Hardware',
    tagline: 'Heavy stock. Heavier margins.',
    status: 'planned',
    priority: 5,
    shortDescription:
      'Heavy stock units, supplier credit, delivery routing, bonded vs duty-paid ledger.',
    for: [
      'Hardware shops and timber yards',
      'Building supplies and tools',
      'Steel and aluminium dealers',
    ],
    features: [
      {
        title: 'Heavy / loose stock',
        description: 'Sell by length, weight, sheet, or pack — not just by piece.',
        icon: 'Ruler',
      },
      {
        title: 'Supplier credit aging',
        description:
          'Track payables per supplier with payment schedule. Pay batches via Paystack.',
        icon: 'Receipt',
      },
      {
        title: 'Delivery routing',
        description: 'Dispatch slip, driver assignment, delivery confirmation, fuel cards.',
        icon: 'Truck',
      },
      {
        title: 'Bonded vs duty-paid',
        description: 'Separate registers for bonded warehouse stock vs cleared inventory.',
        icon: 'Warehouse',
      },
    ],
    compliance: [
      'KRA eTIMS auto-receipt',
      'KEBS import standards mark',
      'KRA bonded warehouse register',
    ],
    whatYouNeed: [
      { label: 'KRA PIN', body: 'For receipts and statutory.' },
      { label: 'KEBS records', body: 'Import standards mark per imported SKU.' },
      { label: 'Vehicle list', body: 'For delivery routing.' },
    ],
    pricing: {
      from: 100000,
      cadence: 'one-time',
      note: 'Available with Business licence when shipped (2027).',
    },
  },
]

export function moduleBySlug(slug: string): ModuleSeed | null {
  return MODULES_SEED.find((m) => m.slug === slug) ?? null
}

export function moduleSlugs(): string[] {
  return MODULES_SEED.map((m) => m.slug)
}
