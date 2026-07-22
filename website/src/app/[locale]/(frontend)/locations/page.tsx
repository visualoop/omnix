import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

import { LocationsIndex } from '@/components/marketing/locations-index'
import { BreadcrumbJsonLd } from '@/components/seo/jsonld'
import { publishedLocations } from '@/config/locations'
import { buildKenyaOnlyAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { preserveSafeQuery, type RedirectSearchParams } from '@/lib/redirect-query'
import { getSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  // Local city hubs are Kenya-only content: the canonical always lives at
  // /ke/locations, never the visitor's market locale.
  const canonical = `${SITE_URL}/ke/locations`
  const hasPublished = publishedLocations().length > 0

  // Non-ke locales 308 to /ke (noindex,follow as defence in depth). On /ke, an
  // index with nothing published yet is still not advertised for indexing.
  const robots =
    locale !== 'ke'
      ? { index: false, follow: true }
      : hasPublished
        ? undefined
        : { index: false, follow: true }

  return {
    title: 'Buying Omnix across Kenya · City guides · Omnix',
    description:
      'How businesses in Kenyan towns choose Omnix: local operating patterns, the five products, the offline and connected boundary, and honest pricing. A buying guide, not a local office.',
    robots,
    alternates: {
      canonical,
      languages: buildKenyaOnlyAlternatesLanguages('/locations'),
    },
    ...buildSocialMetadata({
      // Kenya-only content: canonical is always /ke, so social locale is en_KE.
      locale: 'ke',
      url: canonical,
      title: 'Buying Omnix across Kenya',
      description:
        'City-level buying guides for Kenyan business owners, with honest offline and pricing facts. No local office claims.',
      type: 'website',
    }),
  }
}

export default async function LocationsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ locale }, queryValues] = await Promise.all([params, searchParams])

  // Kenya-only: any non-ke market permanently (308) redirects to the canonical
  // /ke hub before any settings/registry work. Only safe query rides along.
  if (locale !== 'ke') {
    const suffix = preserveSafeQuery(queryValues)
    permanentRedirect(`/ke/locations${suffix}`)
  }

  const settings = await getSiteSettings()
  const locations = publishedLocations()

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: `${SITE_URL}/ke` },
          { name: 'Locations', url: `${SITE_URL}/ke/locations` },
        ]}
      />
      <LocationsIndex locale="ke" locations={locations} whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
