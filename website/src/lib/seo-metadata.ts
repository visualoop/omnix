/**
 * Shared Open Graph + Twitter metadata builder for every indexable public
 * page.
 *
 * Why this exists — Next.js *shallow-merges* the `openGraph` (and `twitter`)
 * objects from a child `generateMetadata` over the parent layout's. It does
 * NOT deep-merge: the moment a child page declares its own `openGraph: { … }`,
 * the whole object replaces the layout's, so any field the child omits
 * (images, siteName, locale) is simply dropped rather than inherited. Twitter
 * behaves the same way, so a child that never sets `twitter` keeps the
 * homepage's homepage-specific card.
 *
 * The fix is to stop relying on inheritance and give every indexable page a
 * complete, self-contained social block built here. Each page passes its own
 * page-specific title / description / canonical URL / type; this helper always
 * fills in siteName, the correct per-country og:locale, a 1200×630 image with
 * an honest alt, and a `summary_large_image` Twitter card that mirrors the
 * page-specific title and description.
 *
 * No network request is made: when no approved licensed image is supplied we
 * point at the first-party, locally generated `/api/og` card (rendered on the
 * server), using an absolute URL so the tag is valid regardless of
 * `metadataBase`.
 */
import type { Metadata } from 'next'

import { BRAND_NAME } from '@/lib/brand'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

/** Standard Open Graph image dimensions (matches the /api/og renderer). */
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

/**
 * Country route → Open Graph locale (underscore form, e.g. `en_KE`).
 *
 * Every market is English-language (see COUNTRY_TO_LANG in i18n/routing), so
 * each country maps to `en_<REGION>`. This mirrors the country list in
 * i18n/routing's COUNTRY_LOCALES exactly.
 */
export const OG_LOCALE_BY_COUNTRY: Record<string, string> = {
  ke: 'en_KE', us: 'en_US', gb: 'en_GB', ng: 'en_NG', gh: 'en_GH',
  za: 'en_ZA', in: 'en_IN', rw: 'en_RW', tz: 'en_TZ', ug: 'en_UG',
  eg: 'en_EG', ae: 'en_AE',
}

/**
 * Home-market default for language-only routes (/sw, /fr, …) or an unknown
 * locale. Kenya is the home market, so we fall back to `en_KE`.
 */
export const DEFAULT_OG_LOCALE = 'en_KE'

/** Map a URL locale segment to its Open Graph locale. */
export function ogLocaleFor(locale: string): string {
  return OG_LOCALE_BY_COUNTRY[locale.toLowerCase()] ?? DEFAULT_OG_LOCALE
}

/**
 * Absolute URL to the locally generated Open Graph card for a page title.
 * The title is URL-encoded so punctuation (`&`, `<`, `·`, …) is safe. No
 * remote fetch — /api/og renders the PNG on the server.
 */
export function generatedOgImage(title: string): string {
  return `${SITE_URL}/api/og?title=${encodeURIComponent(title)}`
}

export interface SocialMetadataInput {
  /** URL locale segment (e.g. 'ke', 'us'). Drives og:locale. */
  locale: string
  /** Absolute canonical URL for the page (used as og:url). */
  url: string
  /** Page-specific social title (og:title + twitter:title). */
  title: string
  /** Page-specific social description (og:description + twitter:description). */
  description: string
  /** Open Graph object type. Defaults to 'website'. */
  type?: 'website' | 'article'
  /**
   * Approved, rights-cleared image URL. When absent/empty the first-party
   * generated /api/og card is used instead — never a remote default.
   */
  image?: string | null
  /** Honest alt text for the image. Defaults to the page title. */
  imageAlt?: string
  /** Article-only: ISO publish timestamp. */
  publishedTime?: string
  /** Article-only: ISO last-modified timestamp. */
  modifiedTime?: string
  /** Article-only: author names. */
  authors?: string[]
}

export interface SocialMetadata {
  openGraph: NonNullable<Metadata['openGraph']>
  twitter: NonNullable<Metadata['twitter']>
}

/**
 * Build a complete, self-contained Open Graph + Twitter block for an indexable
 * page. Spread the result into the page's returned `Metadata`:
 *
 *   const social = buildSocialMetadata({ locale, url: canonical, title, description })
 *   return { title, description, alternates, openGraph: social.openGraph, twitter: social.twitter }
 */
export function buildSocialMetadata(input: SocialMetadataInput): SocialMetadata {
  const {
    locale,
    url,
    title,
    description,
    type = 'website',
    image,
    imageAlt,
    publishedTime,
    modifiedTime,
    authors,
  } = input

  const imageUrl = image && image.trim().length > 0 ? image : generatedOgImage(title)
  const alt = imageAlt && imageAlt.trim().length > 0 ? imageAlt : title
  const ogLocale = ogLocaleFor(locale)
  const images = [{ url: imageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt }]

  const openGraph: NonNullable<Metadata['openGraph']> =
    type === 'article'
      ? {
          type: 'article',
          siteName: BRAND_NAME,
          title,
          description,
          url,
          locale: ogLocale,
          images,
          publishedTime,
          modifiedTime,
          authors,
        }
      : {
          type: 'website',
          siteName: BRAND_NAME,
          title,
          description,
          url,
          locale: ogLocale,
          images,
        }

  const twitter: NonNullable<Metadata['twitter']> = {
    card: 'summary_large_image',
    title,
    description,
    images: [imageUrl],
  }

  return { openGraph, twitter }
}
