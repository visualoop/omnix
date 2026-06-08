/**
 * Documentation seed — the canonical source of truth for /docs.
 *
 * The /docs index AND /docs/[slug] both read from DOCS_SEED, so slugs can
 * never drift out of sync (which previously caused 404s).
 *
 * 5 detailed docs (full body) + 20 scaffolds (summary + TODO sections).
 */

export interface DocSeed {
  slug: string
  title: string
  excerpt: string
  category: 'Basics' | 'Core' | 'Modules' | 'Integrations' | 'Billing' | 'Troubleshooting'
  icon: string
  body: string
}

const scaffold = (heading: string, intro: string, sections: string[]): string =>
  `${intro}\n\n${sections.map((s) => `## ${s}\n\nTODO: document this.`).join('\n\n')}`

export const DOCS_SEED: DocSeed[] = [
  // ─── DETAILED (5) ─────────────────────────────────────────────────────
  {
    slug: 'getting-started',
    title: 'Getting started',
    excerpt: 'Install Omnix, activate your licence or trial, complete the setup wizard, and ring your first sale.',
    category: 'Basics',
    icon: 'RocketLaunch',
    body: `Welcome to Omnix — the offline-first ERP for Kenyan businesses. This guide takes you from download to your first sale in about ten minutes.

## Download and install

Get the latest installer from [omnix.co.ke/downloads](https://omnix.co.ke/downloads). Run the \`.exe\`. If Windows shows a SmartScreen warning ("Windows protected your PC"), click **More info → Run anyway** — the installer is verified by a SHA-256 hash shown on the downloads page.

Omnix installs per-user (no admin rights needed) and takes about 30 seconds.

## Start a free trial or activate a licence

On first launch you'll see the activation screen. You have two choices:

- **Start a 30-day free trial** — pick the module that fits your trade (Dawa for pharmacy, Retail, Hardware, or Hospitality). No card required.
- **Activate a licence** — if you've already bought one, paste the licence key. The key binds to this machine.

Already on a trial and ready to buy? Click **Buy now** right on the activation screen — it opens the checkout in your browser, you pay once (KES 100,000, no subscription), and the key arrives by email. Paste it back into Omnix to activate.

## Complete the setup wizard

The wizard collects:

1. **Your trade** — tailors the app to your business.
2. **Business details** — name, address, phone, KRA PIN. These print on receipts and eTIMS invoices.
3. **Owner account** — your sign-in. Only the owner can reset other users' passwords or change billing.

## Ring your first sale

Open **POS**, search a product (or scan its barcode — Omnix detects USB scanners automatically), add it to the cart, and hit **Pay**. Choose cash, M-Pesa, or card. Done — your first sale is recorded, stock is decremented, and (if eTIMS is configured) a KRA invoice is auto-signed.

## Next steps

- [Add your products and variants](/docs/inventory)
- [Set up M-Pesa](/docs/mpesa)
- [Configure KRA eTIMS](/docs/etims)
- [Turn on cloud backup](/docs/cloud-backup)`,
  },
  {
    slug: 'pos',
    title: 'Point of sale',
    excerpt: 'The full checkout workflow — search, scan, holds, returns, split payments, M-Pesa, card, and the customer display.',
    category: 'Core',
    icon: 'ShoppingCart',
    body: `The POS screen is built for speed. Everything is reachable by keyboard, and a USB barcode scanner works out of the box.

## Adding items

- **Search** by name, SKU, or category in the search box.
- **Scan** a barcode — Omnix auto-detects HID scanners; the scan lands in the cart even if the search box isn't focused.
- **Variants** — if a product has sizes/weights (e.g. 5kg, 10kg, 25kg flour), a picker appears so you choose the right one with the right price.
- **Pack/carton barcodes** — scanning a carton barcode adds the full pack quantity automatically.

## Holds and recall

Mid-sale and need to serve someone else? Hit **Hold** to park the cart, serve the next customer, then **Recall** to bring it back. Useful at busy tills.

## Payment methods

Tap **Pay** to open the payment sheet:

- **Cash** — enter the amount tendered; Omnix calculates change.
- **M-Pesa** — STK push via Daraja or Paystack; the customer confirms on their phone.
- **Card** — via Paystack.
- **Split payment** — combine methods (e.g. KES 500 cash + rest on M-Pesa).
- **Customer credit** — charge to a customer's account if they have a credit limit.

## Returns and refunds

Open **Returns**, find the original sale, select the lines to return, and choose the refund method. Stock is added back and the refund is logged for the Z-report.

## Customer display

If you run a second screen facing the customer, enable it in **Settings → Customer Display**. It shows the running cart, totals, and a payment-success animation — with an optional privacy mode that hides item names.`,
  },
  {
    slug: 'inventory',
    title: 'Inventory & variants',
    excerpt: 'Add products, manage variants (sizes and weights), bulk-import from CSV, run stock takes, and track batches and expiry.',
    category: 'Core',
    icon: 'Package',
    body: `Inventory is the backbone of Omnix. Get this right and POS, reports, and eTIMS all follow.

## Adding a product

Open **Inventory → Add Product**. The barcode field auto-focuses, so you can scan straight away. Fill in name, category, buying and selling price, and your reorder level.

## Variants — same product, different size or weight

Many products come in multiple sizes: maize flour at 2kg, 5kg, 10kg; cooking oil at 500ml, 1L, 5L. Click the **Variants** button (layers icon) on any product row.

Each variant has:
- its own name (e.g. "10kg")
- its own SKU (auto-generated if you leave it blank)
- its own price (leave blank to inherit the product's price)
- its own stock count

At the till, scanning or selecting the product shows a picker so the cashier rings up the exact size at the exact price.

## Bulk import

Have hundreds of products? Use **Inventory → Import CSV**. Download the template, fill it in Excel, and upload. Columns: name, sku, barcode, unit, buying_price, selling_price, initial_stock, reorder_level, tax_rate.

## Stock takes

Run a physical count under **Stock Take**. Count each item, enter the counted quantity, and Omnix shows the variance. Apply the adjustments to write the corrections into inventory with a full audit trail.

## Batches and expiry

For pharmacies and perishables, track batches with expiry dates. Omnix warns you when stock is near expiry and uses FEFO (first-expiry-first-out) at the till.`,
  },
  {
    slug: 'etims',
    title: 'KRA eTIMS setup',
    excerpt: 'Connect Omnix to KRA eTIMS so every sale is auto-signed, and generate your VAT3 return.',
    category: 'Integrations',
    icon: 'FileText',
    body: `Omnix has KRA eTIMS built in — no third-party middleware. Every sale can be auto-signed and submitted.

## Before you start

You'll need your KRA PIN and your eTIMS credentials (the device serial + CU details KRA issued you). Have your business KRA PIN handy.

## Configure eTIMS

Open **Settings → eTIMS**. Enter your KRA PIN, the eTIMS environment (sandbox for testing, production for live), and your device credentials. Save and run **Test connection** — Omnix sends a test invoice and confirms KRA accepted it.

## How signing works

Once configured, every completed sale is queued for signing. Omnix submits the invoice, KRA returns a signature + QR code, and that prints on the customer's receipt. If you're offline, invoices queue and sign automatically when the connection returns.

## The eTIMS queue

**Reports → eTIMS** shows the queue: signed, pending, and any failures. Failed invoices retry automatically; you can also retry manually or inspect the KRA error.

## VAT3 return

At month-end, Omnix generates your VAT3 return from the signed invoices — output VAT, input VAT, and the net position — ready to file.`,
  },
  {
    slug: 'cloud-backup',
    title: 'Cloud backup & restore',
    excerpt: 'Turn on encrypted offsite backups, schedule them, and restore your database on a new machine.',
    category: 'Core',
    icon: 'CloudArrowUp',
    body: `Cloud backup keeps an encrypted copy of your database offsite, so a stolen or dead laptop never means lost data.

## How the encryption works

Backups are encrypted on your device with AES-256-GCM **before** they leave. The encryption key is derived from your password plus your licence key — which means we, the Omnix team, **cannot** read your data. It also means the same password + licence will decrypt the backup on any machine.

## Enable cloud backup

Open **Settings → Cloud Backup**. The feature requires an active paid licence with a cloud-backup window. Click **Back up now**, enter a backup password (use something you'll remember — it cannot be recovered), and Omnix uploads the encrypted snapshot.

## Schedule automatic backups

Toggle **Daily auto-backup** and pick an interval (hourly to weekly). While you're signed in, Omnix backs up in the background — no password prompts, because the key is held in memory for the session. You'll get a quiet confirmation toast on each successful run.

## Restore on a new machine

Reinstalled Omnix or moved to a new laptop?

1. Activate the **same licence**.
2. Open **Settings → Cloud Backup** — your backups appear in the list.
3. Click **Restore** on the backup you want, enter the **same password** you used to create it.
4. Omnix downloads, verifies the SHA-256, decrypts, and stages the restore. Restart to apply.

A safety snapshot of the current database is taken before any restore, so you can always roll back.`,
  },

  // ─── SCAFFOLDS (20) ───────────────────────────────────────────────────
  {
    slug: 'ai',
    title: 'AI assistant',
    excerpt: 'The in-app AI concierge — what it can do, which provider to choose, how to bring your own key, and how to disable it.',
    category: 'Core',
    icon: 'Sparkle',
    body: `Every Omnix variant ships with an in-app AI assistant — a slide-out chat panel that knows the entire product, KRA / NHIF / SHA flows, M-Pesa, and your live data. It can navigate, search, summarise, and explain eTIMS errors in plain English.

## Open the assistant

Press **Ctrl+J** anywhere in the app, or click the sparkle button bottom-right. The panel slides in from the right; press **Esc** or click outside to close.

## What it can do today

The assistant has read-only access to a handful of tools:

- \`navigate(route)\` — opens any screen in Omnix in one tap
- \`getTodaySales()\` — today's revenue, count, and payment-method breakdown
- \`getInventoryAlerts()\` — products at or below reorder level
- \`searchProducts(q)\` — find by name, SKU, or barcode (top 10)
- \`searchCustomers(q)\` — find by name, phone, or email (top 10)
- \`getRecentSales(limit)\` — list the last N sales
- \`openDocs(slug?)\` — opens this docs site to the right page

It cannot yet create / update / delete records. Mutations ship in v0.5 with a confirmation flow.

## Bring your own model

Open **Settings → AI**. Pick a provider, paste an API key, save. The assistant uses your key for every call.

- Groq — free tier, very fast (console.groq.com)
- OpenRouter — free + premium models (openrouter.ai)
- Google — free Gemini Flash (aistudio.google.com)
- OpenAI — pay per token (platform.openai.com)
- Anthropic — pay per token (console.anthropic.com)
- DeepSeek — pay per token (platform.deepseek.com)
- Custom — any OpenAI-compatible URL

Switch providers any time. Keys are encrypted at rest with AES-256.

## Privacy

Calls go directly from your machine to the provider you chose. Omnix never sees your prompts, your responses, your keys, or your live data. Disable the assistant entirely from **Settings → AI → Disable** — the button hides and no AI traffic leaves the app.

## Variant-aware persona

Each Omnix variant biases the assistant toward its trade. Omnix Dawa speaks chemist vocabulary (prescriptions, expiry, controlled register, SHA). Omnix Hospitality speaks chef vocabulary (tables, KOT, recipes, food cost). The Pro variant adapts to whichever module you're currently in.

## Useful starter prompts

- "What did we sell today?"
- "What's running low?"
- "Explain this eTIMS error: CU-12345"
- "Find me Panadol Extra"
- "Auto-fill this product's description"
- "How do I file VAT3 with KRA?"
- "Take me to today's Z-report"`,
  },
  {
    slug: 'banking',
    title: 'Banking & reconciliation',
    excerpt: 'Record bank accounts, transfers, and reconcile statements against your books.',
    category: 'Core',
    icon: 'Bank',
    body: scaffold('Banking', 'Track bank accounts, deposits, transfers, and reconcile against statements.', ['Adding a bank account', 'Recording deposits and withdrawals', 'Transfers between accounts', 'Reconciling a statement']),
  },
  {
    slug: 'payroll',
    title: 'Payroll & statutory',
    excerpt: 'Run monthly payroll with PAYE, NHIF/SHA, NSSF, and housing levy deductions.',
    category: 'Core',
    icon: 'Users',
    body: scaffold('Payroll', 'Run payroll for your staff with all Kenyan statutory deductions.', ['Adding employees', 'Salary structure and allowances', 'PAYE, NSSF, SHA, housing levy', 'Generating payslips', 'Month-end payroll run']),
  },
  {
    slug: 'sales',
    title: 'Sales & receipts',
    excerpt: 'Review sales history, reprint receipts, and understand the daily Z-report.',
    category: 'Core',
    icon: 'Receipt',
    body: scaffold('Sales', 'Every completed sale lives here — searchable, reprintable, reportable.', ['Browsing sales history', 'Reprinting a receipt', 'The daily Z-report', 'Voids and their audit trail']),
  },
  {
    slug: 'customers',
    title: 'Customers & credit',
    excerpt: 'Manage customer profiles, credit limits, and account statements.',
    category: 'Core',
    icon: 'UserCircle',
    body: scaffold('Customers', 'Track customers, their credit limits, and lifetime value.', ['Adding a customer', 'Setting a credit limit', 'Charging a sale to account', 'Customer statements']),
  },
  {
    slug: 'suppliers',
    title: 'Suppliers',
    excerpt: 'Keep supplier records and link them to purchase orders.',
    category: 'Core',
    icon: 'Truck',
    body: scaffold('Suppliers', 'Manage who you buy from.', ['Adding a supplier', 'Supplier contact and terms', 'Linking to purchase orders']),
  },
  {
    slug: 'purchases',
    title: 'Purchases & GRN',
    excerpt: 'Raise purchase orders, receive goods, and update stock.',
    category: 'Core',
    icon: 'ClipboardText',
    body: scaffold('Purchases', 'From purchase order to goods-received note.', ['Creating a purchase order', 'Receiving goods (GRN)', 'Handling partial deliveries', 'Cost updates on receipt']),
  },
  {
    slug: 'expenses',
    title: 'Expenses',
    excerpt: 'Record business expenses and categorise them for the P&L.',
    category: 'Core',
    icon: 'Wallet',
    body: scaffold('Expenses', 'Capture every shilling out.', ['Recording an expense', 'Expense categories', 'Petty cash', 'Expenses in the P&L']),
  },
  {
    slug: 'pnl',
    title: 'Profit & loss',
    excerpt: 'Read your P&L statement and understand your margins.',
    category: 'Core',
    icon: 'ChartLine',
    body: scaffold('P&L', 'Your profit and loss at a glance.', ['Reading the P&L', 'Revenue vs cost of goods', 'Gross and net margin', 'Period comparisons']),
  },
  {
    slug: 'reports',
    title: 'Reports',
    excerpt: 'Sales, inventory valuation, Z-report, and the daily operations book.',
    category: 'Core',
    icon: 'ChartBar',
    body: scaffold('Reports', 'Every report Omnix offers.', ['Sales reports', 'Inventory valuation', 'Z-report', 'Daily operations / day book', 'Exporting to Excel/PDF']),
  },
  {
    slug: 'insurance-claims',
    title: 'Insurance claims',
    excerpt: 'SHA and private insurance: member verification, copay split, and claim batches.',
    category: 'Modules',
    icon: 'ShieldCheck',
    body: scaffold('Insurance', 'Process SHA and private insurance claims at the till.', ['Verifying a member', 'Copay vs claim split', 'Building a claim batch', 'Settling a batch', 'Reconciling payer payments']),
  },
  {
    slug: 'pharmacy',
    title: 'Pharmacy (Dawa)',
    excerpt: 'Dispensing, drug interactions, controlled substances, and patient profiles.',
    category: 'Modules',
    icon: 'FirstAid',
    body: scaffold('Dawa', 'The pharmacy module — built for Kenyan chemists.', ['Dispensing a prescription', 'Drug interaction checks', 'Controlled substance register', 'Patient profiles and allergies', 'Expiry management']),
  },
  {
    slug: 'retail',
    title: 'Retail',
    excerpt: 'Brands, variants, laybys, special orders, and shrinkage tracking.',
    category: 'Modules',
    icon: 'Storefront',
    body: scaffold('Retail', 'Tools for mini-marts and general retail.', ['Brands', 'Variants', 'Laybys', 'Special orders', 'Shrinkage tracking']),
  },
  {
    slug: 'hardware',
    title: 'Hardware & building',
    excerpt: 'Quotations, delivery notes, contractor accounts, and commissions.',
    category: 'Modules',
    icon: 'Wrench',
    body: scaffold('Hardware', 'For hardware shops and building suppliers.', ['Quotations', 'Delivery notes', 'Contractor accounts', 'Sales commissions', 'Bulk pricing tiers']),
  },
  {
    slug: 'hospitality',
    title: 'Hospitality',
    excerpt: 'Restaurant POS, kitchen display, tables, rooms, bookings, folios, and recipes.',
    category: 'Modules',
    icon: 'ForkKnife',
    body: scaffold('Hospitality', 'Restaurant and hotel operations.', ['Menu and items', 'Tables and floor plan', 'Kitchen display (KOT)', 'Rooms and bookings', 'Folios', 'Recipe costing']),
  },
  {
    slug: 'multi-branch',
    title: 'LAN multi-device sync',
    excerpt: 'Run multiple tills on one shop network with a master/client setup.',
    category: 'Core',
    icon: 'Network',
    body: scaffold('LAN sync', 'Pair multiple devices over your shop network.', ['Master vs client', 'Pairing a new device', 'How sync works offline', 'Revoking a device']),
  },
  {
    slug: 'mpesa',
    title: 'M-Pesa (Daraja & Paystack)',
    excerpt: 'Accept M-Pesa via STK push, either with Safaricom Daraja directly or through Paystack.',
    category: 'Integrations',
    icon: 'CreditCard',
    body: scaffold('M-Pesa', 'Two ways to take M-Pesa in Omnix.', ['Daraja STK push setup', 'Paystack M-Pesa setup', 'Reconciling M-Pesa payments', 'Handling failed/timeout payments']),
  },
  {
    slug: 'licence-activation',
    title: 'Licence & activation',
    excerpt: 'How licensing works, machine binding, and transferring to a new device.',
    category: 'Billing',
    icon: 'Key',
    body: scaffold('Licensing', 'Everything about your Omnix licence.', ['How per-machine licensing works', 'Finding your machine ID', 'Transferring to a new device', 'Maintenance and updates window']),
  },
  {
    slug: 'trial-to-buy',
    title: 'Trial to purchase',
    excerpt: 'Buy a licence mid-trial without losing your data.',
    category: 'Billing',
    icon: 'ShoppingBag',
    body: scaffold('Trial to buy', 'Upgrade from trial to a paid licence seamlessly.', ['Buying during a trial', 'What happens to your data', 'Entering your new key', 'Pricing — pay once, no subscription']),
  },
  {
    slug: 'permissions',
    title: 'Users & permissions',
    excerpt: 'Roles, groups, and the access model that keeps cashiers out of the books.',
    category: 'Basics',
    icon: 'Lock',
    body: scaffold('Permissions', 'Control who can do what.', ['Roles and the permission matrix', 'Groups', 'Creating a cashier vs manager', 'The access explorer / audit']),
  },
  {
    slug: 'install-troubleshooting',
    title: 'Install troubleshooting',
    excerpt: 'SmartScreen warnings, antivirus false positives, and rare startup issues.',
    category: 'Troubleshooting',
    icon: 'Warning',
    body: `Most Omnix installs succeed in a single click. When they don't, it's almost always one of these.

## SmartScreen warning

Windows shows a "Windows protected your PC" dialog for any installer not signed by an extended-validation certificate. Click **More info → Run anyway**. The installer is verified by a SHA-256 hash shown on the downloads page.

## Antivirus false positive

Some AV tools flag the installer because it bundles SQLite and writes to a local data directory — a heuristic false positive, not a real threat. Add the installer to your AV exclusions, or wait 24 hours for the vendor to auto-clear it.

## "Database is locked"

Rare. Happens if Omnix is force-killed mid-write. Restart your machine; SQLite recovers cleanly. If it persists, send a diagnostic from Settings → Help.`,
  },
]

export function docSlugs(): string[] {
  return DOCS_SEED.map((d) => d.slug)
}

export function docBySlug(slug: string): DocSeed | null {
  return DOCS_SEED.find((d) => d.slug === slug) ?? null
}
