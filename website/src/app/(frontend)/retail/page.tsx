import type { Metadata } from 'next'
import { VariantLanding, type VariantLandingContent } from '@/components/marketing/variant-landing'

export const metadata: Metadata = {
  title: 'Omnix Retail — POS + inventory for Kenyan shops',
  description:
    'Brands, variants, layby, special orders, shrinkage tracking, KRA eTIMS, M-Pesa Daraja. Built for the duka-meets-Quickbooks generation.',
}

const content: VariantLandingContent = {
  id: 'retail',
  productName: 'Omnix Retail',
  tagline: 'Retail POS for Kenyan shops',
  hero: {
    eyebrow: 'Omnix Retail',
    title: <>The till that <em>moves</em> with you</>,
    description:
      'POS, inventory, brands, variants, layby, special orders and shrinkage — built for the speed your duka or mini-mart actually runs at. Vibrant, fast, KRA-compliant.',
  },
  whoFor: {
    eyebrow: 'Built for',
    items: [
      'Mini-marts and supermarkets',
      'Cosmetics shops',
      'Boutiques and gift shops',
      'Mama mboga / mama Njeri shops',
      'Fashion and accessories',
      'Phone & accessories shops',
    ],
  },
  signatureFeatures: [
    {
      title: 'Variants done right',
      description: 'Track each colour, size or shade as its own SKU with shared cost-of-goods. Reorder by variant, not by parent product.',
    },
    {
      title: 'Layby that pays',
      description: 'Customer pays in instalments, the item is held with deposit + balance tracking. Auto-reminders, no missed pickups, no tied-up stock.',
    },
    {
      title: 'Special orders',
      description: 'Pre-orders, custom orders, drop-shipped items. Promised by-date, deposit captured at sale, supplier PO auto-generated.',
    },
    {
      title: 'Shrinkage, measured',
      description: 'Track every adjustment, damage, theft, with cost analysis. Per-employee shrinkage trends. KRA-defensible counts.',
    },
    {
      title: 'KRA eTIMS, automatic',
      description: 'Every receipt signed and submitted. VAT 16% by default, configurable per product. CU-invoice and CU-receipt formats both supported.',
    },
    {
      title: 'M-Pesa, like cash',
      description: 'STK push via Daraja or Paystack. Cashier sees confirmation in 2 seconds. Reconciliation with bank statements at end of day.',
    },
    {
      title: 'AI concierge built in',
      description: 'Ask "what sold today?" or "auto-fill this product" and the assistant answers from your live data. Bring your own model (Groq free tier or OpenAI premium).',
    },
  ],
  compliance: [
    'KRA eTIMS auto-signing',
    'M-Pesa Daraja STK push',
    'Paystack card + M-Pesa',
    'VAT 16% / 8% / 0% per product',
    'Multi-branch LAN sync',
    'Per-machine signed licence',
  ],
  pricingNote:
    'One-time licence per device, — perpetual licence, no annual fees. No per-transaction cuts, no subscription, no surprises.',
  downloadHref: '/signup?variant=retail',
  buyHref: '/buy?variant=retail',
}

export default function RetailPage() {
  return <VariantLanding content={content} />
}
