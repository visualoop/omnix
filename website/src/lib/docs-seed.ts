/**
 * Documentation seed — replaces Payload Pages where kind='help' until CMS data lands.
 */

export interface DocSeed {
  slug: string
  title: string
  excerpt: string
  category: 'setup' | 'modules' | 'integrations' | 'troubleshooting' | 'pricing'
  body: string
}

export const DOCS_SEED: DocSeed[] = [
  {
    slug: 'install-troubleshooting',
    title: 'Install troubleshooting on Windows',
    excerpt:
      'SmartScreen warnings, antivirus false positives, and the rare cases where Omnix refuses to start.',
    category: 'troubleshooting',
    body: `Most Omnix installs succeed in a single click. When they don't, it's almost always one of these.

## SmartScreen warning

Windows 10 and 11 show a "Windows protected your PC" dialog when you run any installer that isn't signed by an extended-validation certificate. Omnix is signed by Tauri's signing scheme, but EV certificates cost over USD 350/year, which we currently can't justify for a small Kenyan vendor.

Click **More info** under the warning, then **Run anyway**. The installer is verified through our own SHA-256 hash, which you can check on the downloads page.

## Antivirus false positive

Some antivirus tools — Avast, AVG, Kaspersky, occasionally Windows Defender on first sight — flag the Omnix installer because it bundles SQLite and writes to a local data directory. This is a heuristic false positive, not a real threat.

Add the installer to your AV exclusions, or wait 24 hours: most AV vendors auto-clear flags within a day for installers being downloaded by many users.

## "Omnix cannot start because of a missing DLL"

This appears on very old Windows builds. Open Windows Update and apply all pending updates. The required Visual C++ runtime ships with Windows updates from 2021 onward.

## "Database is locked"

Rare. Happens if Omnix is force-killed while writing. Restart your machine; SQLite recovers cleanly on next launch. If the problem persists, send us the diagnostic dump from Settings → Help → Send diagnostic and we'll investigate.

## Still stuck?

WhatsApp the owner — usually replies within an hour during Kenyan business hours. Include your machine ID (Settings → About) and a screenshot of the error.`,
  },
  {
    slug: 'find-licence-key',
    title: 'Where to find your licence key',
    excerpt: 'In the desktop app and on the website. Two places, one key.',
    category: 'setup',
    body: `Your licence key is one string in the format **OMNIX-XXXX-XXXX-XXXX**. It's emailed to you when you pay, and it's visible in two places:

## In the desktop app

Open Settings → Licence. The key is shown at the top with a copy-to-clipboard button. The same screen shows the tier (Starter / Business / Enterprise), the modules included, and the expiry of your maintenance subscription.

## On the website

Sign in at https://omnix.co.ke/login. Your dashboard's overview shows the active licence. Click into it to see the key, the machines registered to it, payments tied to it, and the upgrade path to v2.0 when available.

## What if I lost my licence email?

Sign in to your account on the website. The licence key is always visible there. If you've also lost access to the email account, contact support and we'll verify your identity using your KRA PIN and the M-Pesa or card reference of your original payment.

## Activating a new computer

Each tier allows multiple PCs (3 for Starter, 10 for Business). On a new install, paste the licence key when prompted. The machine is automatically registered against your licence. To free a slot from an old machine, deactivate it from the dashboard.`,
  },
  {
    slug: 'first-pos-sale',
    title: 'Your first POS sale, end to end',
    excerpt: 'From product list import through M-Pesa STK push to KRA eTIMS receipt.',
    category: 'setup',
    body: `Five minutes after install, you should be able to ring up your first sale. Here's how.

## 1. Add your products

Settings → Products → Import. Drop in your CSV or Excel. We accept the SKU column, the name, the cost, the sell price, the supplier, and the stock count. The minimum is name + sell price; everything else can be filled in later.

If you don't have a product list yet, just add one product manually (Add product → fill name + price → Save) so you have something to sell.

## 2. Configure M-Pesa

Settings → Integrations → M-Pesa. Enter your Till or Paybill, your consumer key, your consumer secret, and your passkey. We'll verify the credentials on Save.

If you don't have a Till yet, you can still ring sales as cash. Configure M-Pesa later.

## 3. Configure KRA eTIMS

Settings → Integrations → KRA eTIMS. Enter your KRA PIN and your eTIMS endpoint. We'll do a test receipt issuance against KRA's test endpoint to verify it works.

If you're not VAT-registered yet, leave eTIMS off. Sales still ring up; receipts just don't auto-file with KRA.

## 4. Open the till

Click POS in the sidebar. Add your first product to the cart (scan, click the tile, or type the SKU). Click M-Pesa, enter the customer's phone, click Pay.

The customer receives an STK push on their phone. They enter their PIN. Your till waits 30 seconds, then confirms the payment when M-Pesa returns Success. The eTIMS receipt prints automatically (or shows on screen if no printer attached).

That's a sale. Z-report at the end of the day will show it.`,
  },
  {
    slug: 'mpesa-setup',
    title: 'Setting up M-Pesa STK push',
    excerpt: 'Daraja credentials, sandbox testing, and going live.',
    category: 'integrations',
    body: `Omnix uses Safaricom Daraja to power M-Pesa Till and Paybill payments. You need a registered M-Pesa business account and Daraja credentials.

## What you'll need

- Business shortcode (your Till or Paybill number)
- Consumer key (from Daraja portal)
- Consumer secret (from Daraja portal)
- Passkey (from Daraja portal — different from your password)

## Step by step

1. Sign up at developer.safaricom.co.ke
2. Create an app under "My Apps" — give it any name, e.g. "Omnix POS"
3. Copy the consumer key and consumer secret
4. In the Daraja portal go to "STK Push" → "Get LipaNaMpesaPasskey" → copy the passkey
5. In Omnix: Settings → Integrations → M-Pesa, paste all four
6. Enter sandbox first to test, then switch to live when verified

Sandbox accepts test phone +254708374149 with PIN 12345 — useful for verification before going live.

## Common errors

- **"Invalid credentials"** — double check passkey vs password. They're different. Passkey looks like a long base64 string.
- **"Shortcode mismatch"** — your Till or Paybill must match the one registered against the Daraja app.
- **STK push never arrives** — check the customer's phone is on, has signal, and isn't on Do Not Disturb. M-Pesa STK respects phone state.`,
  },
  {
    slug: 'kra-etims',
    title: 'Configuring KRA eTIMS',
    excerpt: 'Receipt issuance from your till to KRA in real time, automatically.',
    category: 'integrations',
    body: `KRA's electronic Tax Invoice Management System (eTIMS) requires VAT-registered businesses to issue receipts to KRA in real time at point of sale. Omnix does this automatically once configured.

## Prerequisites

- KRA PIN (your business PIN, not personal)
- VAT registration certificate
- iTax credentials (for ongoing filing — Omnix issues receipts; you still file VAT returns)
- For high-turnover businesses: a registered eTIMS endpoint (we help configure)

## How Omnix issues receipts

Every successful sale at the POS triggers eTIMS receipt issuance in the background. You don't see a separate step. The receipt prints (or displays on screen) with the KRA control unit signature, the QR-code verification link, and the receipt number from KRA's system.

## What if eTIMS is down?

KRA's system has occasional outages. Omnix queues receipts locally and re-issues them when KRA is back. Customers get an interim receipt with "eTIMS pending" — when KRA confirms, the receipt is automatically updated and the customer can re-print.

The 24-hour ceiling on late issuance still applies. If KRA is down for more than 24 hours, you have a problem we'll help triage by phone.

## Verifying a receipt

Customers (or KRA auditors) can scan the QR code on any Omnix receipt and verify it directly on KRA's portal. Receipts that don't pass verification mean either KRA hasn't confirmed yet (queued state) or the receipt was tampered with.`,
  },
  {
    slug: 'multi-branch',
    title: 'Setting up multi-branch with LAN sync',
    excerpt: 'Master / client topology, branch transfers, role-based access per branch.',
    category: 'modules',
    body: `When you have two or more branches, you have decisions to make. Omnix's LAN-based topology is designed for the common Kenyan SME case: branches on local internet connections, occasionally syncing across.

## The model

Each branch runs its own copy of Omnix with its own SQLite database. One machine per branch is the master; others are clients. Cross-branch operations (transfers, consolidated reports, central payroll) go through a designated "main" branch.

## Setup at the first branch

Settings → Branches → Add. Set this branch as the main branch. Add staff, products, suppliers, and till configuration as you would for a single-shop install.

## Setting up a second branch

Install Omnix on the new branch's machines. On first launch, choose "Join existing organisation" → enter the licence key + the main-branch URL (LAN IP or internet domain). The new branch syncs the product catalogue, supplier list, and shared customer records.

## Branch transfers

Inventory → Transfers → New. Pick destination branch, products, quantities. The stock leaves your branch immediately into "in-transit" status. The receiving branch confirms receipt to complete the transfer. Variance is automatic; if the count differs, both sides see the variance flag.

## Role-based access

Each staff member gets a role per branch. A cashier at Branch A who's a manager at Branch B sees different surfaces depending on which branch they're logged into. Owner-level access cuts across all branches.`,
  },
  {
    slug: 'major-version-upgrade',
    title: 'How major version upgrades work',
    excerpt: 'Why we do them, when they happen, and what you pay.',
    category: 'pricing',
    body: `We ship one major version per year — v1, v2, v3, …. Major versions are how we make significant changes (architecture, new modules, redesigns) without forcing them on customers who're happy where they are.

## What's in a major version

New modules, breaking changes (database migrations that aren't backwards-compatible), and redesigns of large surfaces. Bug fixes and minor features ship in dot releases (v1.1, v1.2, …) at no cost during your maintenance period.

## The pricing

Major upgrades are priced separately at 50 % off the list price for current owners. So if v2 ships at KES 100,000 list (Starter tier), current Starter owners pay KES 50,000 to upgrade.

You're never forced to upgrade. v1.x keeps working forever — your licence has no remote kill switch. We continue to ship statutory updates (KRA, NHIF, SHA, NSSF rate changes) on the most recent version of each major branch for at least 18 months.

## When upgrades make sense

When the new major contains a feature you need, or a vertical module you've been waiting for. We document major-version highlights in the changelog when each ships, so you can decide.

## Trial before upgrading

You can run v2 alongside v1 in trial mode for 30 days before paying the upgrade. The two versions have separate databases — they don't conflict. Once you're satisfied, pay the upgrade fee; your licence's majorVersionCap bumps to 2 and v1 can be uninstalled.`,
  },
] as const

export function docBySlug(slug: string): DocSeed | null {
  return DOCS_SEED.find((d) => d.slug === slug) ?? null
}

export function docSlugs(): string[] {
  return DOCS_SEED.map((d) => d.slug)
}

export function docsByCategory() {
  const map: Record<string, DocSeed[]> = {}
  for (const d of DOCS_SEED) {
    if (!map[d.category]) map[d.category] = []
    map[d.category]!.push(d)
  }
  return map
}
