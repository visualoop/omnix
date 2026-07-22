/**
 * /dawa is the legacy pharmacy landing. Pharmacy consolidated onto the
 * canonical /pharmacy route, so this permanently (308) redirects, preserving
 * the active locale and any safe query (campaign / demo params). Security-
 * sensitive params are stripped before forwarding — see preserveSafeQuery.
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
    title: 'Omnix Pharmacy',
    alternates: { canonical: `${SITE_URL}/${locale}/pharmacy` },
    robots: { index: false, follow: true },
  }
}

export default async function DawaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ locale }, queryValues] = await Promise.all([params, searchParams])
  const suffix = preserveSafeQuery(queryValues)
  permanentRedirect(`/${locale}/pharmacy${suffix}`)
}
