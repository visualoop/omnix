import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { LocationHub } from '@/components/marketing/location-hub'
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/seo/jsonld'
import { publishedLocationBySlug, publishedLocationSlugs } from '@/config/locations'
import { buildKenyaOnlyAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { preserveSafeQuery, type RedirectSearchParams } from '@/lib/redirect-query'
import { getSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'
export const dynamicParams = false
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export function generateStaticParams() {
  return publishedLocationSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const location = publishedLocationBySlug(slug)

  if (!location) {
    return {
      title: 'Location not found · Omnix',
      robots: { index: false, follow: false },
    }
  }

  // Kenya-only content: canonical always resolves to /ke, never the visitor's
  // market locale.
  const canonical = `${SITE_URL}/ke/locations/${location.slug}`

  return {
    title: location.metaTitle,
    description: location.metaDescription,
    keywords: location.keywords,
    // Non-ke locales 308 to /ke; keep them noindex,follow as defence in depth.
    robots: locale === 'ke' ? undefined : { index: false, follow: true },
    alternates: {
      canonical,
      languages: buildKenyaOnlyAlternatesLanguages(`/locations/${location.slug}`),
    },
    ...buildSocialMetadata({
      locale: 'ke',
      url: canonical,
      title: location.ogTitle,
      description: location.ogDescription,
      type: 'article',
    }),
  }
}

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ locale, slug }, queryValues] = await Promise.all([params, searchParams])

  // Kenya-only: any non-ke market permanently (308) redirects to the canonical
  // /ke hub before any settings/registry work. Only safe query rides along.
  if (locale !== 'ke') {
    const suffix = preserveSafeQuery(queryValues)
    permanentRedirect(`/ke/locations/${slug}${suffix}`)
  }

  const location = publishedLocationBySlug(slug)

  if (!location) {
    notFound()
  }

  const settings = await getSiteSettings()
  const canonical = `${SITE_URL}/ke/locations/${location.slug}`

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: `${SITE_URL}/ke` },
          { name: 'Locations', url: `${SITE_URL}/ke/locations` },
          { name: location.city, url: canonical },
        ]}
      />
      {/* A city buying guide is editorial content, so it carries Article schema.
          It never emits local-business, address, review or rating structured
          data: Omnix has no verified local presence to describe. */}
      <ArticleJsonLd
        headline={`${location.title} ${location.titleAccent}`.trim()}
        description={location.metaDescription}
        url={canonical}
        datePublished={location.updated}
        dateModified={location.updated}
      />
      <LocationHub location={location} locale="ke" whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
