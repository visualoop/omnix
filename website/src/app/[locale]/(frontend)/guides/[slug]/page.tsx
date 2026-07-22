import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { BuyerGuide } from '@/components/marketing/buyer-guide'
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/seo/jsonld'
import { publishedGuideBySlug, publishedGuideSlugs } from '@/config/guides'
import { buildKenyaOnlyAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { preserveSafeQuery, type RedirectSearchParams } from '@/lib/redirect-query'
import { getSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'
export const dynamicParams = false
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export function generateStaticParams() {
  return publishedGuideSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const guide = publishedGuideBySlug(slug)

  if (!guide) {
    return {
      title: 'Guide not found · Omnix',
      robots: { index: false, follow: false },
    }
  }

  // Kenya-only content: canonical always resolves to /ke, never the visitor's
  // market locale.
  const canonical = `${SITE_URL}/ke/guides/${guide.slug}`

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    keywords: guide.keywords,
    // Non-ke locales 308 to /ke; keep them noindex,follow as defence in depth.
    robots: locale === 'ke' ? undefined : { index: false, follow: true },
    alternates: {
      canonical,
      languages: buildKenyaOnlyAlternatesLanguages(`/guides/${guide.slug}`),
    },
    ...buildSocialMetadata({
      locale: 'ke',
      url: canonical,
      title: guide.ogTitle,
      description: guide.ogDescription,
      type: 'article',
    }),
  }
}

export default async function GuideDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ locale, slug }, queryValues] = await Promise.all([params, searchParams])

  // Kenya-only: any non-ke market permanently (308) redirects to the canonical
  // /ke guide before any settings/registry work. Only safe query rides along.
  if (locale !== 'ke') {
    const suffix = preserveSafeQuery(queryValues)
    permanentRedirect(`/ke/guides/${slug}${suffix}`)
  }

  const guide = publishedGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  const settings = await getSiteSettings()
  const canonical = `${SITE_URL}/ke/guides/${guide.slug}`

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: `${SITE_URL}/ke` },
          { name: 'Buyer guides', url: `${SITE_URL}/ke/guides` },
          { name: guide.product.label.replace('Omnix ', ''), url: canonical },
        ]}
      />
      <ArticleJsonLd
        headline={`${guide.title} ${guide.titleAccent}`.trim()}
        description={guide.metaDescription}
        url={canonical}
        datePublished={guide.updated}
        dateModified={guide.updated}
      />
      <BuyerGuide guide={guide} locale="ke" whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
