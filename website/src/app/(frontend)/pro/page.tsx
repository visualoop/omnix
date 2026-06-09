import type { Metadata } from 'next'
import { VariantLanding, type VariantLandingContent } from '@/components/marketing/variant-landing'

export const metadata: Metadata = {
  title: 'Omnix Pro — All four trades, one binary',
  description:
    'Run two or more trades from one app — pharmacy + canteen, hotel + retail shop, hardware + canteen. Omnix Pro bundles Dawa, Retail, Hospitality and Hardware.',
}

const content: VariantLandingContent = {
  id: 'pro',
  productName: 'Omnix Pro',
  tagline: 'All four trades — one binary',
  hero: {
    eyebrow: 'Omnix Pro',
    title: <>One app. <em>Every trade.</em></>,
    description:
      'For Kenyan businesses that span more than one trade: chemist + canteen, hotel + retail shop, hardware + soko. Switch between modules with a click. One database, one licence, one team.',
  },
  whoFor: {
    eyebrow: 'Built for',
    items: [
      'Multi-trade owners',
      'Hotel chains with retail outlets',
      'Pharmacy + clinic combos',
      'Hardware + paint + plumbing under one roof',
      'Restaurants with retail',
      'Anyone who outgrew a single-trade till',
    ],
  },
  signatureFeatures: [
    {
      title: 'Module switcher',
      description: 'One click to change context — pharmacy in the morning, canteen at lunch, retail in the afternoon. The data stays unified, the UI adapts.',
    },
    {
      title: 'Shared data',
      description: 'One customer database, one supplier list, one chart of accounts. Cross-trade reports give you the bigger picture (and the consolidated tax return).',
    },
    {
      title: 'Per-employee permissions',
      description: 'Cashier sees till. Pharmacist sees prescriptions. Chef sees recipes. Manager sees everything. Role-based access, audited.',
    },
    {
      title: 'Multi-branch sync',
      description: 'Run several locations on the same network. Each branch can have a different active module — Pro lets the same binary serve them all.',
    },
    {
      title: 'KRA eTIMS, automatic',
      description: 'Every sale signed and submitted, regardless of which module it came from. Per-module VAT rates, per-module HS codes.',
    },
    {
      title: 'Future-proof',
      description: 'When new modules ship (electronics, salon, agribusiness), Pro picks them up automatically. No re-buy, no re-install.',
    },
    {
      title: 'AI concierge — every trade',
      description: 'The assistant adapts its persona to whichever module you\'re in: chemist vocabulary in Dawa, chef vocabulary in Hospitality, contractor vocabulary in Hardware. Bring your own model.',
    },
  ],
  compliance: [
    'KRA eTIMS auto-signing across all modules',
    'PPB controlled-substance register (Dawa)',
    'SHA + private insurance claims (Dawa)',
    'M-Pesa Daraja + Paystack (all modules)',
    'Multi-branch LAN sync',
    'Per-machine signed licence',
  ],
  pricingNote:
    'One-time licence per device. Same KES 30,000 + 12,000/year as the trade variants — Pro just unlocks all four. No per-module charge.',
  downloadHref: '/signup?variant=pro',
  buyHref: '/buy?variant=pro',
}

export default function ProPage() {
  return <VariantLanding content={content} />
}
