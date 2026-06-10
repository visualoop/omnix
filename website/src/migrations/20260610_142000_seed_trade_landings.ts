import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Seed the trade-landings global with the canonical copy each variant
 * had hardcoded prior to v0.4.10. Idempotent — only writes a variant tab
 * if it has no productName yet.
 */

interface VariantSeed {
  productName: string
  tagline: string
  metaTitle?: string
  metaDescription?: string
  hero: { eyebrow: string; titlePrefix: string; titleEmphasis?: string; titleSuffix?: string; description: string }
  whoFor: { eyebrow: string; items: { label: string }[] }
  signatureFeatures: { title: string; description: string }[]
  compliance: { item: string }[]
  pricingNote: string
  cta: { buyHref: string; downloadHref: string; buyLabel: string; trialLabel: string }
}

const SEEDS: Record<string, VariantSeed> = {
  pro: {
    productName: 'Omnix Pro',
    tagline: 'All four trades on one machine',
    metaTitle: 'Omnix Pro — All four trades on one machine',
    metaDescription:
      'Pharmacy, retail, hospitality, hardware — every module unlocked on one Windows install. KRA eTIMS + SHA + M-Pesa included.',
    hero: {
      eyebrow: 'Omnix Pro',
      titlePrefix: 'One install. ',
      titleEmphasis: 'Every',
      titleSuffix: ' trade.',
      description:
        'Pharmacy, retail, hospitality, hardware — all four modules unlocked on one machine. Switch between trades without switching software.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Multi-trade businesses' },
        { label: 'Holding companies' },
        { label: 'Retail + pharmacy combos' },
        { label: 'Hotels with shops' },
        { label: 'Diversified SMEs' },
        { label: 'Founders running 2+ businesses' },
      ],
    },
    signatureFeatures: [
      { title: 'All four modules', description: 'Dawa + Retail + Hospitality + Hardware unlocked on the same install. Pick which one each branch uses.' },
      { title: 'Per-branch configuration', description: 'Branch A runs Dawa, Branch B runs Retail. Same database, same reports, different POS layouts.' },
      { title: 'Unified reporting', description: 'P&L across all trades. KRA eTIMS submissions in one place. Inventory across modules.' },
      { title: 'AI assistant', description: 'A trade-aware AI inside the app. "Top performing branch this month?" "Why is hardware margin trailing retail?"' },
      { title: 'KRA eTIMS, one signing', description: 'Every sale across every trade signed and submitted from a single eTIMS device.' },
      { title: 'LAN multi-device', description: 'Designate a master, every branch syncs over LAN. No internet required.' },
      { title: 'Per-machine licence', description: 'RSA-signed licence per device. Pay once, own forever.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'PPB pharmacy controls (Dawa)' },
      { item: 'KEBS retail compliance' },
      { item: 'Hospitality F&B levy' },
      { item: 'Hardware bonded warehouse' },
      { item: 'Per-machine signed licence' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=pro', downloadHref: '/signup?variant=pro', buyLabel: 'Buy Omnix Pro', trialLabel: 'Start 30-day free trial' },
  },
  dawa: {
    productName: 'Omnix Dawa',
    tagline: 'Pharmacy management for Kenyan chemists',
    metaTitle: 'Omnix Dawa — Pharmacy management for Kenyan chemists',
    metaDescription:
      'Prescriptions, drug labels, refills, expiry, controlled-substance register, KRA eTIMS, SHA + private insurance claims. Pay once, own it forever.',
    hero: {
      eyebrow: 'Omnix Dawa',
      titlePrefix: 'The till every ',
      titleEmphasis: 'chemist',
      titleSuffix: ' deserves',
      description:
        'Pharmacy-grade POS with prescriptions, expiry tracking, controlled-substance register, drug-drug warnings, KRA eTIMS and SHA insurance claims. Calm and compliant.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Independent chemists' },
        { label: 'Pharmacy chains (1–10 branches)' },
        { label: 'Hospital pharmacies' },
        { label: 'Clinic dispensaries' },
        { label: 'PPB-licensed pharmacists' },
        { label: 'Mama na mtoto chemists' },
      ],
    },
    signatureFeatures: [
      { title: 'Prescriptions, properly', description: 'Patient profiles with allergies, conditions, and medication history. Drug-drug warnings at point of sale. Refill tracking with automatic dose calculations.' },
      { title: 'Expiry that actually works', description: 'Batch-level expiry tracking with 30/60/90-day alerts. The till sells the soonest-expiring batch first by default. No more pharmacy waste.' },
      { title: 'Controlled register, daily', description: 'Statutory daily register for narcotics and psychotropics. PPB-format export. Pharmacist-on-duty tracking with sign-on/sign-off.' },
      { title: 'SHA + private insurance', description: 'Member verification, copay split, claim submission. NHIF, AAR, Jubilee, CIC and any other private payer with API. Reconciliation built in.' },
      { title: 'KRA eTIMS, automatic', description: 'Every sale is signed and submitted. VAT exemption for medicaments. Pharmacy-specific HS codes pre-loaded. No third-party plugin.' },
      { title: 'Multi-branch sync', description: 'Run two or more chemists on the same network — stock, prices, customers, debts all sync over LAN. Clinic dispensary on a Surface tablet? Works the same.' },
      { title: 'AI concierge built in', description: 'A chemist-aware AI assistant inside the app. Ask "what\'s expiring next month?" or "explain this eTIMS error" — gets answers from your live data.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing on every sale' },
      { item: 'PPB controlled-substance daily register' },
      { item: 'SHA + NHIF + private insurance claims' },
      { item: 'PPB pharmacist-of-record tracking' },
      { item: 'Schedule II–IV narcotic logging' },
      { item: 'Per-machine signed licence (Argon2 + RSA)' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees. No per-prescription fees, no subscription, no surprises.',
    cta: { buyHref: '/buy?variant=dawa', downloadHref: '/signup?variant=dawa', buyLabel: 'Buy Omnix Dawa', trialLabel: 'Start 30-day free trial' },
  },
  retail: {
    productName: 'Omnix Retail',
    tagline: 'Retail POS for shops, mini-marts, and dukas',
    metaTitle: 'Omnix Retail — Retail POS for shops, mini-marts, and dukas',
    metaDescription:
      'Barcode scanning, layby, M-Pesa, customer credit, supplier reconciliation, KRA eTIMS — built for Kenyan retail.',
    hero: {
      eyebrow: 'Omnix Retail',
      titlePrefix: 'A till that ',
      titleEmphasis: 'thinks',
      titleSuffix: ' like a shopkeeper',
      description:
        'Barcode scanning, layby, M-Pesa, customer credit, supplier reconciliation, KRA eTIMS — built for Kenyan retail.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Mini-marts and dukas' },
        { label: 'Boutiques and clothing stores' },
        { label: 'Bookshops and stationery' },
        { label: 'Electronics shops' },
        { label: 'Beauty supply shops' },
        { label: 'Multi-branch retail chains' },
      ],
    },
    signatureFeatures: [
      { title: 'Barcode-first POS', description: 'Scan, weigh, sell. SKU + barcode lookup with 50ms response. Custom keyboard shortcuts for top sellers.' },
      { title: 'Layby + customer credit', description: 'Layby with deposit tracking. Per-customer credit limits with auto-block when exceeded. M-Pesa STK push to clear debts.' },
      { title: 'Supplier reconciliation', description: 'Goods received notes, supplier accounts, payable ledger. Automatic 3-way match between PO, GRN, and supplier invoice.' },
      { title: 'M-Pesa STK push', description: 'Native Daraja integration. Customer pays from their phone, the till closes the sale automatically. No till float juggling.' },
      { title: 'KRA eTIMS, hands-free', description: 'Every receipt signed and submitted. VAT3 return generated automatically. eTIMS device on the till works for every branch.' },
      { title: 'Multi-branch + LAN', description: 'Designate a master shop, the rest sync over LAN. Stock transfers between branches with two-step approval.' },
      { title: 'AI insights', description: 'Bestsellers, slow movers, margin per category — ask in plain English. "Why was Tuesday so quiet?"' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'KEBS standardisation marks' },
      { item: 'M-Pesa STK push (Daraja)' },
      { item: 'KRA VAT3 return generator' },
      { item: 'Per-machine signed licence' },
      { item: 'Argon2 password hashing' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=retail', downloadHref: '/signup?variant=retail', buyLabel: 'Buy Omnix Retail', trialLabel: 'Start 30-day free trial' },
  },
  hospitality: {
    productName: 'Omnix Hospitality',
    tagline: 'POS for restaurants, bars, lodges',
    metaTitle: 'Omnix Hospitality — POS for restaurants, bars, lodges',
    metaDescription:
      'KOT printing, table-side orders, room folios, recipe costing, F&B levy, M-Pesa, KRA eTIMS — for restaurants, bars and lodges.',
    hero: {
      eyebrow: 'Omnix Hospitality',
      titlePrefix: 'Tickets to ',
      titleEmphasis: 'kitchen',
      titleSuffix: '. Bills to table.',
      description:
        'KOT printing, table-side orders, room folios, recipe costing, F&B levy, M-Pesa, KRA eTIMS — for restaurants, bars and lodges.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Restaurants and cafes' },
        { label: 'Bars and pubs' },
        { label: 'Lodges and small hotels' },
        { label: 'Catering operations' },
        { label: 'Quick-service kitchens' },
        { label: 'Members clubs' },
      ],
    },
    signatureFeatures: [
      { title: 'KOT to kitchen', description: 'Print Kitchen Order Tickets to multiple stations (grill, hot, cold, bar). Order modifiers, course timing, "fire" command from waiter.' },
      { title: 'Table & folio management', description: 'Floor map, drag tables, transfer items between tables, split bills, room charges to folios. Open tabs, paid tabs, all in one screen.' },
      { title: 'Recipe costing', description: 'Per-dish ingredient breakdowns. Real-time food cost per plate. Yield tracking on cuts and prep.' },
      { title: 'F&B levy + KRA eTIMS', description: 'Hospitality 2% F&B levy auto-calculated. KRA eTIMS signing on every receipt. VAT and levy reports for KRA filing.' },
      { title: 'M-Pesa till + card', description: 'Every payment method including M-Pesa Pochi for tips. Combined splits (cash + card + M-Pesa) on one bill.' },
      { title: 'Multi-station LAN', description: 'POS at the bar, KOT at the grill, billing at the till — all syncing over LAN. Designate a master server, the rest follow.' },
      { title: 'AI assistant', description: '"Top selling cocktail this month?" "Plates with margin under 30%?" Plain-English questions over your live data.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'F&B levy auto-calculation' },
      { item: 'TRA tourism levy support' },
      { item: 'M-Pesa STK + Pochi' },
      { item: 'PPB liquor licence tracking' },
      { item: 'Per-machine signed licence' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=hospitality', downloadHref: '/signup?variant=hospitality', buyLabel: 'Buy Omnix Hospitality', trialLabel: 'Start 30-day free trial' },
  },
  hardware: {
    productName: 'Omnix Hardware',
    tagline: 'POS for hardware stores and contractors',
    metaTitle: 'Omnix Hardware — POS for hardware stores and contractors',
    metaDescription:
      'Bulk pricing tiers, contractor accounts, parts catalogues, deliveries, GRNs, KRA eTIMS — for hardware stores supplying construction in Kenya.',
    hero: {
      eyebrow: 'Omnix Hardware',
      titlePrefix: 'Built like ',
      titleEmphasis: 'rebar',
      titleSuffix: '.',
      description:
        'Bulk pricing tiers, contractor accounts, parts catalogues, deliveries, GRNs, KRA eTIMS — for hardware stores supplying construction in Kenya.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Hardware stores' },
        { label: 'Building material suppliers' },
        { label: 'Plumbing & electrical wholesalers' },
        { label: 'Tile & sanitary ware shops' },
        { label: 'Contractor supply yards' },
        { label: 'Multi-branch hardware chains' },
      ],
    },
    signatureFeatures: [
      { title: 'Bulk pricing tiers', description: 'Per-product price brackets (1–10, 11–100, 100+). Contractor discount sheets. Project-specific quotes that auto-apply at the till.' },
      { title: 'Contractor accounts', description: 'Per-contractor credit limit, statement, project tagging. Tied to KRA PIN for invoicing. Auto-reminders when balance is overdue.' },
      { title: 'Parts catalogue + variants', description: 'SKUs with sub-variants (size, gauge, finish). Cross-reference codes (Crown vs Plascon vs Bauer). Smart search across all spelling variants.' },
      { title: 'Deliveries + GRNs', description: 'Track delivery vehicle, off-load time, delivery proof. Goods Received Notes with three-way match. Truck-load layby for contractors.' },
      { title: 'KRA eTIMS, every invoice', description: 'Every contractor invoice signed. VAT for taxable items, exemption for exports. EFD-ready for cash sales above KES 5K.' },
      { title: 'Multi-branch + LAN', description: 'Branch A receives stock, Branch B sells. All synced over LAN. Inter-branch transfer slips with approval.' },
      { title: 'AI for hardware', description: '"Iron sheets sold this week?" "Top contractor by spend this quarter?" Plain-English over live data.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'KRA VAT3 return generator' },
      { item: 'KEBS standardisation marks' },
      { item: 'M-Pesa STK + Pochi' },
      { item: 'NCA contractor verification' },
      { item: 'Per-machine signed licence' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=hardware', downloadHref: '/signup?variant=hardware', buyLabel: 'Buy Omnix Hardware', trialLabel: 'Start 30-day free trial' },
  },
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    const cur = (await payload.findGlobal({
      slug: 'trade-landings',
      overrideAccess: true,
    })) as unknown as Record<string, { productName?: string } | undefined>

    const update: Record<string, VariantSeed> = {}
    for (const v of ['pro', 'dawa', 'retail', 'hospitality', 'hardware'] as const) {
      if (!cur[v]?.productName) {
        update[v] = SEEDS[v]
      }
    }
    if (Object.keys(update).length > 0) {
      await payload.updateGlobal({
        slug: 'trade-landings',
        data: update as never,
        overrideAccess: true,
        req,
      })
    }
  } catch (e) {
    payload.logger.warn(`trade-landings seed skipped: ${(e as Error).message}`)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op.
}
