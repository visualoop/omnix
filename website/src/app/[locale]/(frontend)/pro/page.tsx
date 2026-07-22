/**
 * /pro was the public landing for the all-trades "Omnix Pro" variant.
 *
 * Pro is no longer sold or positioned publicly. The five named products
 * (Pharmacy, Retail, Hospitality, Hardware & Equipment, Salon & Spa) are the
 * only public catalogue, so /pro permanently (308) redirects to the product
 * catalogue where a visitor self-selects a trade. Existing Pro licensees keep
 * access through their dashboard; that machinery is untouched.
 *
 * Locale and safe query are preserved; security-sensitive params are dropped.
 */
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { preserveSafeQuery, type RedirectSearchParams } from '@/lib/redirect-query'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'Omnix products',
    alternates: { canonical: `${SITE_URL}/${locale}/modules` },
    robots: { index: false, follow: true },
  }
}

export default async function ProPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ locale }, queryValues] = await Promise.all([params, searchParams])
  const suffix = preserveSafeQuery(queryValues)
  permanentRedirect(`/${locale}/modules${suffix}`)
}
