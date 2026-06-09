import type { Metadata } from 'next'
import { VariantLanding, type VariantLandingContent } from '@/components/marketing/variant-landing'

export const metadata: Metadata = {
  title: 'Omnix Dawa — Pharmacy management for Kenyan chemists',
  description:
    'Prescriptions, drug labels, refills, expiry, controlled-substance register, KRA eTIMS, SHA + private insurance claims. Pay once, own it forever.',
}

const content: VariantLandingContent = {
  id: 'dawa',
  productName: 'Omnix Dawa',
  tagline: 'Pharmacy management for Kenyan chemists',
  hero: {
    eyebrow: 'Omnix Dawa',
    title: <>The till every <em>chemist</em> deserves</>,
    description:
      'Pharmacy-grade POS with prescriptions, expiry tracking, controlled-substance register, drug-drug warnings, KRA eTIMS and SHA insurance claims. Calm and compliant.',
  },
  whoFor: {
    eyebrow: 'Built for',
    items: [
      'Independent chemists',
      'Pharmacy chains (1–10 branches)',
      'Hospital pharmacies',
      'Clinic dispensaries',
      'PPB-licensed pharmacists',
      'Mama na mtoto chemists',
    ],
  },
  signatureFeatures: [
    {
      title: 'Prescriptions, properly',
      description: 'Patient profiles with allergies, conditions, and medication history. Drug-drug warnings at point of sale. Refill tracking with automatic dose calculations.',
    },
    {
      title: 'Expiry that actually works',
      description: 'Batch-level expiry tracking with 30/60/90-day alerts. The till sells the soonest-expiring batch first by default. No more pharmacy waste.',
    },
    {
      title: 'Controlled register, daily',
      description: 'Statutory daily register for narcotics and psychotropics. PPB-format export. Pharmacist-on-duty tracking with sign-on/sign-off.',
    },
    {
      title: 'SHA + private insurance',
      description: 'Member verification, copay split, claim submission. NHIF, AAR, Jubilee, CIC and any other private payer with API. Reconciliation built in.',
    },
    {
      title: 'KRA eTIMS, automatic',
      description: 'Every sale is signed and submitted. VAT exemption for medicaments. Pharmacy-specific HS codes pre-loaded. No third-party plugin.',
    },
    {
      title: 'Multi-branch sync',
      description: 'Run two or more chemists on the same network — stock, prices, customers, debts all sync over LAN. Clinic dispensary on a Surface tablet? Works the same.',
    },
    {
      title: 'AI concierge built in',
      description: 'A chemist-aware AI assistant inside the app. Ask "what\'s expiring next month?" or "explain this eTIMS error" — gets answers from your live data. Bring your own key (Groq free, OpenAI premium).',
    },
  ],
  compliance: [
    'KRA eTIMS auto-signing on every sale',
    'PPB controlled-substance daily register',
    'SHA + NHIF + private insurance claims',
    'PPB pharmacist-of-record tracking',
    'Schedule II–IV narcotic logging',
    'Per-machine signed licence (Argon2 + RSA)',
  ],
  pricingNote:
    'One-time licence per device, plus KES 12,000/year for compliance updates. No per-prescription fees, no subscription, no surprises.',
  downloadHref: '/signup?variant=dawa',
  buyHref: '/buy?variant=dawa',
}

export default function DawaPage() {
  return <VariantLanding content={content} />
}
