import Link from 'next/link'
import { cookies } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { CURRENCIES, formatPrice, tierPrice, type PricingTierShape, type SupportedCurrency } from '@/lib/currency'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { SoftwareJsonLd } from '@/components/seo/jsonld'

export type VariantId = 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'pro'

interface VariantData {
  productName?: string
  tagline?: string
  metaTitle?: string
  metaDescription?: string
  hero?: {
    eyebrow?: string
    titlePrefix?: string
    titleEmphasis?: string
    titleSuffix?: string
    description?: string
  }
  whoFor?: {
    eyebrow?: string
    items?: { label: string }[]
  }
  signatureFeatures?: { title: string; description: string }[]
  /**
   * Industry workflow — 4-5 step "this is what a working day looks like".
   * Helps a visitor see themselves in the product without reading the
   * full feature grid. Each step has a short title + one-line body.
   */
  workflow?: { step: string; title: string; body: string }[]
  /**
   * Industry FAQ — 4-6 questions specific to this trade. Rendered as
   * a definition list and emitted as schema.org FAQPage JSON-LD so the
   * answers can surface as Google rich results.
   */
  faq?: { q: string; a: string }[]
  compliance?: { item: string }[]
  pricingNote?: string
  cta?: {
    buyHref?: string
    downloadHref?: string
    buyLabel?: string
    trialLabel?: string
  }
}

/**
 * Default content per variant. Used when the CMS global doesn't yet
 * have a row for this variant (cold-boot, or the seed migration hasn't
 * run). Values match the previously hardcoded copy so behavior stays
 * identical between "before CMS" and "CMS empty".
 */
const FALLBACK: Record<VariantId, VariantData> = {
  pro: {
    productName: 'Omnix Pro',
    tagline: 'All four trades on one machine',
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
    hero: {
      eyebrow: 'Omnix Dawa',
      titlePrefix: 'Pharmacy POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: ' for Kenya',
      description:
        'Lipa na M-Pesa (STK push, Paybill & Till), KRA eTIMS receipts, SHA & private insurance claims, prescriptions, expiry tracking and a controlled-substance register. The chemist till that\'s calm and compliant.',
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
    workflow: [
      { step: '01', title: 'Patient arrives with a prescription', body: 'Search by name, phone or ID. Their allergies, conditions and refill history are on screen before they finish handing it over.' },
      { step: '02', title: 'Dispense by batch, FEFO by default', body: 'Scan the prescribed item; the till offers the soonest-expiring batch first. Drug-drug interaction warnings fire automatically.' },
      { step: '03', title: 'Insurance + copay split', body: 'SHA / NHIF / private payer verified by member number. The system splits the bill and submits the claim in the background.' },
      { step: '04', title: 'Pay the balance over M-Pesa', body: 'STK push, Paybill or Till — whichever the patient prefers. The eTIMS-signed receipt prints with their dispensing label.' },
      { step: '05', title: 'Daily register, automatically', body: 'Controlled-substance ledger writes itself. Pharmacist-on-duty sign-on, dispensing audit, PPB-format export — all there at closing.' },
    ],
    faq: [
      { q: 'Will Omnix Dawa work with my eTIMS device?', a: 'Yes. Omnix signs every sale into KRA eTIMS automatically. You do not need a separate "eTIMS plugin" — the integration ships with the pharmacy module and handles VAT exemption on medicaments by default.' },
      { q: 'Do you support SHA and NHIF claims?', a: 'SHA, NHIF, AAR, Jubilee, CIC and any private payer with an open API. Member verification, copay split, claim submission and reconciliation are built into the dispense flow.' },
      { q: 'Can I run two branches on the same chemist licence?', a: 'Multi-branch sync is built in over LAN — branch B pulls stock, prices, customers and balances from branch A automatically. You pay one licence per device, not per branch.' },
      { q: 'What about controlled substances?', a: 'Omnix keeps a PPB-compliant daily register for Schedule II–IV narcotics and psychotropics. Pharmacist-of-record is captured on every dispense, the daily report exports in PPB format, and you can lock dispense to a logged-in pharmacist.' },
      { q: 'Does it work offline if power and internet drop?', a: 'Yes. The pharmacy till runs entirely off the local SQLite database. eTIMS submissions queue and re-send when the connection returns. You never have to turn customers away because the network died.' },
      { q: 'Can I import my existing product list?', a: 'Yes — Excel, CSV, or barcode scan. The AI helper maps headers and units so you spend minutes on import, not days.' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees. No per-prescription fees, no subscription, no surprises.',
    cta: { buyHref: '/buy?variant=dawa', downloadHref: '/signup?variant=dawa', buyLabel: 'Buy Omnix Dawa', trialLabel: 'Start 30-day free trial' },
  },
  retail: {
    productName: 'Omnix Retail',
    tagline: 'Retail POS for shops, mini-marts, and dukas',
    hero: {
      eyebrow: 'Omnix Retail',
      titlePrefix: 'Retail POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: ' for Kenya',
      description:
        'Lipa na M-Pesa (STK push, Paybill & Till), barcode scanning, layby, customer credit, supplier reconciliation and KRA eTIMS — built for shops, mini-marts and dukas.',
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
    workflow: [
      { step: '01', title: 'Scan or search', body: 'Barcode scanner or 50ms text search by SKU, name or shortcode. Touch-friendly keypad shortcuts for your fastest-moving items.' },
      { step: '02', title: 'Layby or pay', body: 'Full payment in cash, card, M-Pesa STK / Paybill / Till — or hold the sale as a layby with a deposit and pay later.' },
      { step: '03', title: 'Customer credit, controlled', body: 'Regulars on running accounts? Per-customer credit limit blocks new sales when they hit the cap. M-Pesa link to clear arrears.' },
      { step: '04', title: 'KRA eTIMS signs the receipt', body: 'Every receipt is signed and submitted to KRA before it prints. VAT3 builds in the background — you never write a return by hand again.' },
      { step: '05', title: 'Restock the gaps', body: 'End of day, reorder list shows what to buy back. AI explains the slow movers, so you stop tying capital up in stock that does not move.' },
    ],
    faq: [
      { q: 'Does it work with a barcode scanner?', a: 'Yes — any USB or Bluetooth scanner that types like a keyboard works out of the box. Custom keyboard shortcuts cover items without a barcode (loose tea, ugali flour, samosas).' },
      { q: 'Can I run a layby?', a: 'Layby with deposit tracking is built in. You see the outstanding balance on every customer page, and the customer gets an M-Pesa link to top up without coming back to the shop.' },
      { q: 'How does M-Pesa work at the till?', a: 'Three ways. STK Push (cashier enters the customer phone, they approve on theirs). Paybill / Till manual entry (customer pays, cashier confirms the M-Pesa code). And Pochi if you take tips.' },
      { q: 'Will it handle multiple branches?', a: 'Yes. Designate a master shop on the LAN; the other branches sync stock, prices, customers and credit balances in real time. Inter-branch transfers go through two-step approval.' },
      { q: 'Do I need internet to ring a sale?', a: 'No. The till runs fully offline. KRA eTIMS submissions queue and send when the connection returns.' },
      { q: 'How are returns handled?', a: 'A return reverses the original receipt by reference, refunds via the same payment method, and writes a credit note to KRA eTIMS. Stock goes back on the shelf automatically.' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=retail', downloadHref: '/signup?variant=retail', buyLabel: 'Buy Omnix Retail', trialLabel: 'Start 30-day free trial' },
  },
  hospitality: {
    productName: 'Omnix Hospitality',
    tagline: 'POS for restaurants, bars, lodges',
    hero: {
      eyebrow: 'Omnix Hospitality',
      titlePrefix: 'Restaurant & bar POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: '',
      description:
        'Lipa na M-Pesa at the table, KOT printing, room folios, recipe costing, F&B levy and KRA eTIMS — for restaurants, bars and lodges across Kenya.',
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
    workflow: [
      { step: '01', title: 'Seat the table', body: 'Drag-and-drop floor plan with live status. Move covers around mid-service; the bill follows the table, not the seat.' },
      { step: '02', title: 'Fire the order to the kitchen', body: 'Waiters punch in items with modifiers and seat numbers. KOTs print to the right station — grill, hot, cold, bar — as soon as the waiter hits send.' },
      { step: '03', title: 'Run the bar in parallel', body: 'Bar tabs, split bills, course timing, recipe-costed cocktails. Pochi for tips. Pour-by-pour audits for inventory.' },
      { step: '04', title: 'Settle the bill', body: 'M-Pesa STK, cash, card, room charge — combine on one bill. F&B levy and VAT calculated automatically; KRA eTIMS signs the receipt.' },
      { step: '05', title: 'Close the day', body: 'Recipe cost vs revenue, plate margins, top earners, waste log. The Z-report shows you exactly where the night went.' },
    ],
    faq: [
      { q: 'Will it print KOTs to my kitchen?', a: 'Yes. Define stations (grill, hot, cold, bar, pizza). Each item routes to its station automatically with modifiers, seat number, and course timing. Works with any ESC/POS thermal printer over USB or LAN.' },
      { q: 'How does room charge work for lodges?', a: 'Restaurant or bar bills can post directly onto a guest folio. Checkout reconciles the folio with eTIMS-signed receipts. Works for restaurants attached to small hotels and lodges.' },
      { q: 'Can I split a bill?', a: 'Three ways — by item, by seat, or by amount. Split mid-payment if a guest changes their mind. M-Pesa STK + cash + card on one bill works fine.' },
      { q: 'Do you handle the 2% F&B levy?', a: 'Auto-calculated on every restaurant and bar bill, separated from VAT, and filed in the levy report at month-end. TRA tourism levy supported for resort/lodge variants.' },
      { q: 'Recipe costing — how detailed?', a: 'Per-ingredient breakdown with prep yields. Live food-cost % updates as ingredient prices change. Margin alerts when a dish drops below your threshold.' },
      { q: 'Can the bar run separately from the restaurant?', a: 'Yes — separate revenue centres, separate tills, but one customer record. A guest can move from the bar to the restaurant on the same tab.' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=hospitality', downloadHref: '/signup?variant=hospitality', buyLabel: 'Buy Omnix Hospitality', trialLabel: 'Start 30-day free trial' },
  },
  hardware: {
    productName: 'Omnix Hardware',
    tagline: 'POS for hardware stores and contractors',
    hero: {
      eyebrow: 'Omnix Hardware',
      titlePrefix: 'Hardware POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: ' for Kenya',
      description:
        'Lipa na M-Pesa (STK push, Paybill & Till), bulk pricing tiers, contractor accounts, quotations, parts catalogues, deliveries, GRNs and KRA eTIMS — for hardware stores supplying construction.',
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
    workflow: [
      { step: '01', title: 'Contractor walks in with a list', body: 'Pull up their account by KRA PIN or phone. The till loads their contract pricing, project tag and credit limit before they finish reading the list.' },
      { step: '02', title: 'Quote, with bulk pricing', body: 'Tier pricing fires automatically — 1–10 / 11–100 / 100+. Project-specific quote tables apply where they exist. The quote prints as a branded PDF in seconds.' },
      { step: '03', title: 'Pay or charge to account', body: 'M-Pesa STK / Paybill / Till, cash, or charge to their contractor account. Credit limit blocks the sale automatically when the balance would breach it.' },
      { step: '04', title: 'Schedule the delivery', body: 'Delivery note with vehicle, driver and proof-of-receipt signature. The yard releases stock against the note, not the receipt — no double-pulling.' },
      { step: '05', title: 'Collect on time', body: 'Aged receivables on every contractor account. Auto SMS reminders. AI summarises which contractor is slipping and what to chase first.' },
    ],
    faq: [
      { q: 'Do you handle bulk pricing tiers?', a: 'Yes. Per-product brackets (1–10, 11–100, 100+) and contractor-specific discount sheets. The till applies the right tier automatically once it sees who is buying and how much.' },
      { q: 'Can contractors buy on credit?', a: 'Per-contractor accounts with credit limits, statements, and project-level tagging. Tied to KRA PIN for tax-compliant invoices. Auto-reminders when balances go past 30/60/90 days.' },
      { q: 'How are deliveries tracked?', a: 'Goods Received Notes for inbound stock with three-way match against the PO. Delivery notes for outbound with vehicle, driver and signature capture. Truck-load layby for contractors who pay over multiple trips.' },
      { q: 'Will it handle parts variants?', a: 'SKUs with sub-variants (size, gauge, finish). Cross-reference codes so a search for "Crown" finds "Plascon" and "Bauer" equivalents. Useful when a contractor calls a colour by the wrong brand.' },
      { q: 'Does it generate eTIMS invoices for contractor jobs?', a: 'Every contractor invoice is signed and submitted to KRA. VAT for taxable items, exemption for exports and bonded warehouse stock. Quotation converts to invoice in one click without re-keying.' },
      { q: 'Can I run a yard and a counter on the same shop?', a: 'Yes. The yard scans against the delivery note, the counter rings the sale, both share the same stock ledger. No more "I think we have it" — the screen knows.' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=hardware', downloadHref: '/signup?variant=hardware', buyLabel: 'Buy Omnix Hardware', trialLabel: 'Start 30-day free trial' },
  },
}

/**
 * Read variant-specific copy from the CMS. Falls back to the canonical
 * defaults above if the global isn't seeded yet.
 */
async function getVariantContent(variant: VariantId, _locale: string): Promise<VariantData> {
  // Trade landings are static config now (was a Payload global).
  // Always returns the FALLBACK shape — locale-specific overrides can
  // be added later via i18n message files.
  return FALLBACK[variant]
}

/**
 * Read the headline price for this variant from the static pricing config.
 *   Pro    → business.oneTimeFee
 *   others → starter.oneTimeFee
 */
async function getVariantPrice(variant: VariantId): Promise<{ amount: number; currency: SupportedCurrency; display: string }> {
  const { pricing } = await import('@/config/pricing')
  const { COUNTRY_TO_CURRENCY } = await import('@/i18n/routing')
  const locale = await getLocale()
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get('omnix_currency')?.value as SupportedCurrency | undefined

  // Locale URL is the strongest signal (a /us/* page should always price in
  // USD even if the visitor's cookie disagrees). Cookie is the secondary
  // hint. Default falls back to USD (Paystack's universal currency) so a
  // missing cookie + unknown locale doesn't render a Kenya price to the
  // wrong audience.
  const fromLocale = COUNTRY_TO_CURRENCY[locale.toLowerCase()] as SupportedCurrency | undefined
  const currency: SupportedCurrency = (fromLocale && fromLocale in CURRENCIES)
    ? fromLocale
    : (cookieValue && cookieValue in CURRENCIES ? cookieValue : 'USD')

  const tier = variant === 'pro' ? pricing.business : pricing.starter
  const amount = tier.oneTimeFee[currency] ?? tier.oneTimeFee.USD
  return { amount, currency, display: formatPrice(amount, currency) }
}

function HeroTitle({
  prefix,
  emphasis,
  suffix,
}: {
  prefix?: string
  emphasis?: string
  suffix?: string
}) {
  if (!emphasis) return <>{prefix ?? ''}</>
  return (
    <>
      {prefix ?? ''}
      <em>{emphasis}</em>
      {suffix ?? ''}
    </>
  )
}

export async function VariantLanding({ variant }: { variant: VariantId }) {
  const locale = await getLocale()
  const [content, settings, price, slotImage, variantVideo] = await Promise.all([
    getVariantContent(variant, locale),
    getSiteSettings(),
    getVariantPrice(variant),
    // Admin-uploaded module hero (per /admin/media). Falls back to the
    // default glow pattern when nothing is uploaded for this variant.
    (async () => {
      try {
        const { getSlotImage } = await import('@/lib/media-slots')
        return await getSlotImage(`module.${variant}.hero`)
      } catch {
        return null
      }
    })(),
    // Admin-configured video loop for this variant (v0.27.0). Set at
    // /admin/settings → Module page videos. Empty settings → nothing
    // renders in the video slot below the hero.
    (async () => {
      try {
        const { getSetting } = await import('@/lib/platform-settings')
        const key = variant === 'pro' ? null : (`landing.${variant}.video_url` as const)
        const posterKey = variant === 'pro' ? null : (`landing.${variant}.video_poster` as const)
        if (!key || !posterKey) return { url: null, poster: null }
        const [url, poster] = await Promise.all([getSetting(key), getSetting(posterKey)])
        return { url: url ?? null, poster: poster ?? null }
      } catch {
        return { url: null, poster: null }
      }
    })(),
  ])

  const productName = content.productName ?? FALLBACK[variant].productName ?? 'Omnix'
  const hero = content.hero ?? FALLBACK[variant].hero ?? {}
  const whoFor = content.whoFor ?? FALLBACK[variant].whoFor ?? { items: [] }
  const features = content.signatureFeatures ?? FALLBACK[variant].signatureFeatures ?? []
  const workflow = content.workflow ?? FALLBACK[variant].workflow ?? []
  const faq = content.faq ?? FALLBACK[variant].faq ?? []
  const compliance = content.compliance ?? FALLBACK[variant].compliance ?? []
  const pricingNote = content.pricingNote ?? FALLBACK[variant].pricingNote ?? ''
  const cta = content.cta ?? FALLBACK[variant].cta ?? {}
  const buyHref = cta.buyHref ?? `/buy?variant=${variant}`
  const downloadHref = cta.downloadHref ?? `/signup?variant=${variant}`
  const buyLabel = cta.buyLabel ?? `Buy ${productName}`
  const trialLabel = cta.trialLabel ?? 'Start 30-day free trial'

  // FAQPage JSON-LD so the industry-specific Q&A is eligible for Google's
  // rich-result rendering. Only emitted when the variant has FAQ entries.
  const faqJsonLd =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }
      : null

  return (
    <>
      <SoftwareJsonLd variant={variant} currency={price.currency} locale={locale} />
      <PageHero
        eyebrow={hero.eyebrow ?? productName}
        title={
          <HeroTitle
            prefix={hero.titlePrefix}
            emphasis={hero.titleEmphasis}
            suffix={hero.titleSuffix}
          />
        }
        description={hero.description ?? ''}
        backgroundImage={slotImage ? { url: slotImage.url, alt: slotImage.alt } : null}
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={buyHref}>{buyLabel}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={downloadHref}>{trialLabel}</Link>
          </Button>
        </div>
      </PageHero>

      {/* ── Product-in-motion video (v0.27.0) ─────────────────────
          Admin-configurable at /admin/settings → Module page videos.
          Empty → nothing renders. Short (10-25s) muted loop showing
          the product doing the thing — not a marketing video. */}
      {variantVideo.url ? (
        <section className="border-b border-[var(--color-border)]">
          <div className="container-wide -mt-8 pb-16">
            <div className="mx-auto max-w-[1080px]">
              <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_-24px_rgba(0,0,0,0.35)]">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  className="block h-auto w-full"
                  src={variantVideo.url}
                  poster={variantVideo.poster ?? undefined}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={`${productName} — a short loop showing the product`}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Who it's for ──────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
        <div className="container-default">
          <span className="caption-mono">{whoFor.eyebrow ?? 'Built for'}</span>
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {(whoFor.items ?? []).map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]">
                <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Signature features ────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12">
            <span className="caption-mono">What you get</span>
            <h2 className="headline-sub mt-3">
              {productName} — purpose-built for your trade
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal leading-tight text-[var(--color-fg)]">
                  {f.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ────────────────────────────────────────── */}
      {compliance.length > 0 && (
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
          <div className="container-default">
            <span className="caption-mono">Compliant with</span>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {compliance.map((c, i) => (
                <li key={`${c.item}-${i}`} className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]">
                  <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                  {c.item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Workflow ─────────────────────────────────────────────
        A 4–5 step day-in-the-life for this trade. Helps a visitor
        recognise themselves in the product before reading the
        feature grid. Steps are numbered (mono caption) and stack
        vertically on mobile. */}
      {workflow.length > 0 && (
        <section className="section">
          <div className="container-wide">
            <div className="mb-12 max-w-[44rem]">
              <span className="caption-mono">How a day runs on {productName}</span>
              <h2 className="headline-section mt-4 text-balance">
                The flow your <em>team</em> actually works.
              </h2>
            </div>
            <ol className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-5">
              {workflow.map((s) => (
                <li
                  key={s.step}
                  className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                    {s.step}
                  </span>
                  <h3
                    style={{ fontFamily: 'var(--font-display, serif)' }}
                    className="text-[20px] font-medium leading-[1.15] tracking-[-0.01em] text-[var(--color-fg)]"
                  >
                    {s.title}
                  </h3>
                  <p className="text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── Industry FAQ ─────────────────────────────────────────
        Trade-specific Q&A. Emitted twice: once as visible
        definition list for the visitor, once as schema.org
        FAQPage JSON-LD for Google rich results. */}
      {faq.length > 0 && (
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 py-20">
          <div className="container-text">
            <span className="caption-mono">Questions we keep getting</span>
            <h2 className="headline-sub mt-4 mb-10 text-balance">
              {productName} — <em>answered.</em>
            </h2>
            <dl className="divide-y divide-[var(--color-border)]">
              {faq.map((item) => (
                <div key={item.q} className="py-6">
                  <dt className="font-[family-name:var(--font-display)] text-[19px] font-normal text-[var(--color-fg)]">
                    {item.q}
                  </dt>
                  <dd className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)]">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* ── Pricing note ──────────────────────────────────────── */}
      <section className="section">
        <div className="container-default text-center">
          <span className="caption-mono">Pricing</span>
          <h2 className="font-[family-name:var(--font-display)] mt-3 text-[clamp(40px,5vw,72px)] font-normal leading-[1.05] text-[var(--color-fg)]">
            {CURRENCIES[price.currency].symbol} <em>{price.amount.toLocaleString('en-US')}</em>
          </h2>
          <p className="mt-3 text-[15px] text-[var(--color-fg-muted)] max-w-[44ch] mx-auto">
            {pricingNote}
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={buyHref}>{buyLabel}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={downloadHref}>{trialLabel}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* v0.10 highlights — same shape across every variant landing.
          Anchors the cold visitor on what shipped recently without
          competing with the variant-specific feature copy above. */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">New in v0.10</span>
            <h2 className="headline-section mt-5 text-balance">
              The latest, <em>by way of compliance.</em>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">
              The fee buys every Kenyan-tax filing as a branded PDF, the procurement
              workflow Kenyan finance offices actually need, and a customer display that
              looks the part on your second monitor.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-3">
            {[
              {
                eyebrow: 'Compliance',
                title: '16 branded PDFs',
                body: 'VAT3, P9, P10, GRN, hardware quote, Z-report, aged AR/AP and more.',
                href: '/#pdf-pack',
              },
              {
                eyebrow: 'Procurement',
                title: 'PO lifecycle hardening',
                body: 'Mixed currency, approval thresholds, three-way match, reverse-GRN.',
                href: '/docs/purchase-orders',
              },
              {
                eyebrow: 'Front-of-house',
                title: 'Customer display playlist',
                body: 'Image, YouTube, or iframe slides on the second monitor while idle.',
                href: '/docs/customer-display',
              },
            ].map((h) => (
              <li
                key={h.title}
                className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  {h.eyebrow}
                </span>
                <h3
                  style={{ fontFamily: 'var(--font-display, serif)' }}
                  className="text-[22px] font-medium leading-[1.1] tracking-[-0.01em]"
                >
                  {h.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
                  {h.body}
                </p>
                <Link
                  href={h.href}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                >
                  Read more →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}

/** Read just metadata for generateMetadata() in each trade page.
 *
 * Returns a full Next.js Metadata object — title, description,
 * canonical, keywords + OG/Twitter image — built per-variant so each
 * trade landing ranks for the search intent that visitor actually uses
 * ("pharmacy POS Kenya", "restaurant POS Nairobi", etc.).
 *
 * Pages can still spread + override individual fields; see
 * /pharmacy/page.tsx for an example where we re-target the same dawa
 * content under industry-named keywords.
 */
const VARIANT_SEO: Record<VariantId, { title: string; description: string; canonical: string; keywords: string[] }> = {
  pro: {
    title: 'Omnix Pro — Pharmacy + Retail + Hospitality + Hardware POS in one',
    description: 'All four trades on one Omnix licence. Pharmacy, retail, hospitality and hardware in one Windows install with M-Pesa, KRA eTIMS and offline-first. For multi-trade SMEs.',
    canonical: '/pro',
    keywords: [
      'multi-trade POS Kenya', 'pharmacy and retail POS', 'hotel and restaurant POS',
      'multi-business software Kenya', 'all-in-one POS Kenya',
    ],
  },
  dawa: {
    title: 'Pharmacy POS for Kenya · M-Pesa, eTIMS, SHA & insurance — Omnix Dawa',
    description: 'Pharmacy POS built for Kenyan chemists. Lipa na M-Pesa (STK, Paybill, Till), KRA eTIMS receipts, SHA & private insurance claims, prescriptions, expiry alerts and a controlled-substance register. Offline-first, pay once.',
    canonical: '/dawa',
    keywords: [
      'pharmacy POS Kenya', 'chemist POS Kenya', 'pharmacy software Kenya',
      'Dawa POS', 'M-Pesa pharmacy POS', 'SHA pharmacy billing',
      'NHIF pharmacy claims', 'KRA eTIMS pharmacy', 'controlled substance register Kenya',
      'PPB compliant pharmacy software',
    ],
  },
  retail: {
    title: 'Retail POS for Kenya · M-Pesa, barcode, layby, eTIMS — Omnix Retail',
    description: 'Retail POS for shops, mini-marts and dukas. Lipa na M-Pesa (STK, Paybill, Till), barcode scanning, layby, customer credit, supplier reconciliation and KRA eTIMS — built for fast-moving Kenyan retail. Offline-first.',
    canonical: '/retail',
    keywords: [
      'retail POS Kenya', 'mini-mart POS Kenya', 'duka POS Kenya', 'shop POS Kenya',
      'M-Pesa retail POS', 'barcode POS Kenya', 'layby software Kenya', 'KRA eTIMS retail',
      'small business POS Kenya', 'Lipa na M-Pesa retail',
    ],
  },
  hospitality: {
    title: 'Restaurant & bar POS for Kenya · M-Pesa, KOT, folios, F&B levy — Omnix Hospitality',
    description: 'Restaurant, bar and lodge POS for Kenya. Lipa na M-Pesa at the table, kitchen tickets, table & room folios, recipe costing, F&B levy and KRA eTIMS. Built for service speed, offline-first.',
    canonical: '/hospitality',
    keywords: [
      'restaurant POS Kenya', 'bar POS Kenya', 'hotel POS Kenya', 'lodge POS Kenya',
      'M-Pesa restaurant POS', 'KOT system Kenya', 'kitchen display system Kenya',
      'F&B levy Kenya', 'recipe costing software', 'hospitality POS Kenya',
    ],
  },
  hardware: {
    title: 'Hardware-store POS for Kenya · contractor accounts, bulk pricing, eTIMS — Omnix Hardware',
    description: 'Hardware-store POS for Kenya. Lipa na M-Pesa, bulk pricing tiers, quotations, contractor accounts with credit and aged receivables, delivery notes and KRA eTIMS. Built for the counter and the yard.',
    canonical: '/hardware',
    keywords: [
      'hardware store POS Kenya', 'building materials POS Kenya', 'contractor account software',
      'M-Pesa hardware POS', 'bulk pricing software Kenya', 'quotation software Kenya',
      'delivery note software', 'aged receivables Kenya', 'KRA eTIMS hardware',
    ],
  },
}

export async function getVariantMetadata(variant: VariantId): Promise<{
  title: string
  description: string
  alternates: { canonical: string }
  keywords: string[]
  openGraph: {
    title: string
    description: string
    type: 'website'
    images: { url: string; width: number; height: number; alt: string }[]
  }
  twitter: {
    card: 'summary_large_image'
    title: string
    description: string
    images: string[]
  }
}> {
  const seo = VARIANT_SEO[variant]
  const ogImage = `/api/og?title=${encodeURIComponent(seo.title)}`
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    keywords: seo.keywords,
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: seo.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [ogImage],
    },
  }
}
