import type { Metadata } from 'next'
import { VariantLanding, type VariantLandingContent } from '@/components/marketing/variant-landing'

export const metadata: Metadata = {
  title: 'Omnix Hardware — Hardware-store POS with quotes & contractors',
  description:
    'Bulk pricing, quotations, delivery notes, contractor accounts, parts catalog, KRA eTIMS, M-Pesa. Built for Kenyan hardware shops that move heavy stock.',
}

const content: VariantLandingContent = {
  id: 'hardware',
  productName: 'Omnix Hardware',
  tagline: 'Hardware-store POS for Kenya',
  hero: {
    eyebrow: 'Omnix Hardware',
    title: <>Heavy stock. <em>Clean books.</em></>,
    description:
      'Quotations, delivery notes, contractor accounts, bulk pricing tiers, parts catalog. Built for Kenyan hardware shops that sell to anyone from a fundi to a Tier-1 contractor.',
  },
  whoFor: {
    eyebrow: 'Built for',
    items: [
      'Hardware & building materials',
      'Plumbing & electrical wholesalers',
      'Paint & finishing shops',
      'Tools & machinery dealers',
      'Auto parts & accessories',
      'Builders’ merchants',
    ],
  },
  signatureFeatures: [
    {
      title: 'Quotations, signed',
      description: 'Generate professional quotes with bulk pricing, tax-inclusive or tax-exclusive lines. Convert to sale in one click. PDF export with your logo + KRA PIN.',
    },
    {
      title: 'Contractor accounts',
      description: 'Per-contractor credit limit, aging, statements. Tiered pricing (retail / wholesale / contractor / fundi). Auto-apply price tier at the till.',
    },
    {
      title: 'Delivery notes',
      description: 'Track every dispatched order from till to truck to site. Driver sign-off, GPS pin (optional), customer signature on tablet.',
    },
    {
      title: 'Bulk pricing tiers',
      description: 'Buy 50 bags of cement at one price, 500 bags at another. Tier breakpoints configurable per SKU. Auto-discount at quantity.',
    },
    {
      title: 'Sales commissions',
      description: 'Reps earn % per sale. Per-rep dashboards. Auto-calculated payouts at month-end. Per-product commission overrides.',
    },
    {
      title: 'KRA eTIMS, automatic',
      description: 'CU-invoice for B2B contractor sales, CU-receipt for retail walk-ins. VAT inclusive/exclusive per line. eTIMS-defensible audit trail.',
    },
    {
      title: 'AI concierge built in',
      description: 'Ask "draft a quote for 200 bags of cement at contractor pricing" or "what owes the most?" — assistant answers from live data. Bring your own model.',
    },
  ],
  compliance: [
    'KRA eTIMS auto-signing',
    'CU-invoice + CU-receipt formats',
    'M-Pesa Daraja + Paystack',
    'Multi-branch LAN sync',
    'Per-machine signed licence',
    'Contractor credit aging report',
  ],
  pricingNote:
    'One-time licence per device, plus KES 12,000/year for compliance updates. Cement or copper, the price stays the same.',
  downloadHref: '/signup?variant=hardware',
  buyHref: '/buy?variant=hardware',
}

export default function HardwarePage() {
  return <VariantLanding content={content} />
}
