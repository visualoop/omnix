import type { Metadata } from 'next'
import { VariantLanding, type VariantLandingContent } from '@/components/marketing/variant-landing'

export const metadata: Metadata = {
  title: 'Omnix Hospitality — Restaurant & lodge POS for Kenya',
  description:
    'Tables, KOT/kitchen tickets, recipes, menu engineering, room bookings, folios, KRA eTIMS, M-Pesa. Built for Kenyan hospitality speed.',
}

const content: VariantLandingContent = {
  id: 'hospitality',
  productName: 'Omnix Hospitality',
  tagline: 'Restaurant, bar & lodge POS',
  hero: {
    eyebrow: 'Omnix Hospitality',
    title: <>Karibu, <em>chef.</em></>,
    description:
      'Floor plans, kitchen tickets, recipe costing, room bookings and folios. Built for Kenyan restaurants, bars, takeaways and lodges that need to run hot but settle clean.',
  },
  whoFor: {
    eyebrow: 'Built for',
    items: [
      'Restaurants & cafés',
      'Bars & nightclubs',
      'Hotels & lodges',
      'Mama-fua takeaways',
      'Catering services',
      'Resorts & guest houses',
    ],
  },
  signatureFeatures: [
    {
      title: 'Tables, sections, floors',
      description: 'Drag-and-drop floor plan. Move guests between tables, split bills, merge orders. Section-aware printers route to the right kitchen.',
    },
    {
      title: 'Kitchen display, no clutter',
      description: 'KOT auto-routed to bar, hot kitchen, cold kitchen. Bumped tickets archive instantly. Course pacing for fine-dining workflows.',
    },
    {
      title: 'Recipes that cost themselves',
      description: 'Each menu item is a recipe of ingredients with cost. Sell a Tuna Crepe, the till consumes flour, eggs, tuna, oil. Real food cost % per dish.',
    },
    {
      title: 'Rooms & folios',
      description: 'Room calendar with availability + bookings. Restaurant charges post to the guest folio. Check-out shows one consolidated bill.',
    },
    {
      title: 'Service charge, tips, splits',
      description: 'Configurable service charge per section. Tips split by employee or pool. Bills split equally, by item, or by amount.',
    },
    {
      title: 'KRA eTIMS, automatic',
      description: 'Every settled bill signed and submitted. Tip + service charge tracked separately. Daily Z-report ready for the accountant.',
    },
    {
      title: 'AI concierge built in',
      description: 'Ask "what\'s today\'s food cost?" or "which menu items move slowest?" — assistant answers from live data. Karibu vibe baked into the persona.',
    },
  ],
  compliance: [
    'KRA eTIMS auto-signing',
    'Public-Health-compliant kitchen logs',
    'Tip + service-charge separation',
    'M-Pesa Daraja + Paystack',
    'Multi-branch LAN sync',
    'Per-machine signed licence',
  ],
  pricingNote:
    'One-time licence per device, plus KES 12,000/year for compliance updates. Hot or cold, busy or quiet, the price stays the same.',
  downloadHref: '/buy?variant=hospitality',
  buyHref: '/buy?variant=hospitality',
}

export default function HospitalityPage() {
  return <VariantLanding content={content} />
}
