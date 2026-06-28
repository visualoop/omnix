/**
 * /pharmacy — industry-named alias of /dawa.
 *
 * Visitors searching "pharmacy POS Kenya" don't know our product is
 * called Dawa — they know it as "pharmacy software". This route gives
 * them an industry-native landing that renders the same content the
 * /dawa page does, but addressable under the term they actually typed.
 *
 * We render rather than `redirect()` so each URL builds its own page
 * for Google + has independent metadata (different title/keywords),
 * even though the body content is shared via the VariantLanding
 * template.
 */
import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  const base = await getVariantMetadata('dawa')
  return {
    ...base,
    title: 'Pharmacy POS for Kenya — M-Pesa, eTIMS, SHA & insurance · Omnix',
    description:
      'Pharmacy POS for Kenyan chemists. Lipa na M-Pesa (STK, Paybill, Till), KRA eTIMS receipts, SHA + private insurance claims, prescriptions, expiry alerts and a controlled-substance register. Calm and compliant.',
    alternates: { canonical: '/pharmacy' },
    keywords: [
      'pharmacy POS Kenya',
      'chemist POS Kenya',
      'pharmacy software Kenya',
      'Dawa POS',
      'M-Pesa pharmacy POS',
      'SHA pharmacy billing',
      'NHIF pharmacy claims',
      'KRA eTIMS pharmacy',
      'controlled substance register Kenya',
      'PPB compliance software',
    ],
  }
}

export default function PharmacyPage() {
  return <VariantLanding variant="dawa" />
}
