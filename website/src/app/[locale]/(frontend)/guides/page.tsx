import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

import { GuidesIndex } from '@/components/marketing/guides-index'
import { BreadcrumbJsonLd } from '@/components/seo/jsonld'
import { publishedGuides } from '@/config/guides'
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
  // National buyer guides are Kenya-only content: the canonical always lives
  // at /ke/guides, never the visitor's market locale.
  const canonical = `${SITE_URL}/ke/guides`

  return {
    title: 'Kenyan software buyer guides · Omnix',
    description:
      'Honest buyer guides for choosing POS, inventory, pharmacy, restaurant, hardware and salon software in Kenya. Workflow, offline boundary, M-Pesa and eTIMS, migration questions and perpetual pricing.',
    // Non-ke locales 308 to /ke; keep them noindex,follow as defence in depth
    // in case a crawler ever fetches metadata before the redirect resolves.
    robots: locale === 'ke' ? undefined : { index: false, follow: true },
    alternates: {
      canonical,
      languages: buildKenyaOnlyAlternatesLanguages('/guides'),
    },
    ...buildSocialMetadata({
      // Kenya-only content: the canonical is always /ke, so the social locale
      // is en_KE regardless of the requesting market.
      locale: 'ke',
      url: canonical,
      title: 'Kenyan software buyer guides',
      description:
        'Decision-stage guides for choosing business software in Kenya, with honest offline and pricing facts.',
      type: 'website',
    }),
  }
}

export default async function GuidesIndexPage({
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
    permanentRedirect(`/ke/guides${suffix}`)
  }

  const settings = await getSiteSettings()
  const guides = publishedGuides()

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: `${SITE_URL}/ke` },
          { name: 'Buyer guides', url: `${SITE_URL}/ke/guides` },
        ]}
      />
      <GuidesIndex locale="ke" guides={guides} whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
