/**
 * /modules/[slug] used to render a per-module detail page that duplicated the
 * canonical product pages for SEO. Those detail pages are consolidated:
 *
 *   dawa        → /pharmacy      retail      → /retail
 *   hospitality → /hospitality   hardware    → /hardware
 *   salon       → /salon         core (spine) → /modules  (catalogue)
 *   anything else                             → /modules
 *
 * Each entry permanently (308) redirects, preserving the active locale and any
 * safe query; security-sensitive params are stripped. The route file is kept
 * so the 308 behaviour is served for every previously-indexed module slug.
 */
import { permanentRedirect } from 'next/navigation'
import { moduleSlugs } from '@/lib/modules-seed'
import { preserveSafeQuery, type RedirectSearchParams } from '@/lib/redirect-query'

/**
 * Legacy module slug → canonical destination path (locale-free). Slugs that
 * are not a standalone public product (core, and any future non-product
 * module) fold into the catalogue rather than 404-ing an inbound link.
 */
const MODULE_REDIRECTS: Record<string, string> = {
  dawa: '/pharmacy',
  retail: '/retail',
  hospitality: '/hospitality',
  hardware: '/hardware',
  salon: '/salon',
  core: '/modules',
}

export function generateStaticParams() {
  return moduleSlugs().map((slug) => ({ slug }))
}

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ slug, locale }, queryValues] = await Promise.all([params, searchParams])
  const target = MODULE_REDIRECTS[slug] ?? '/modules'
  const suffix = preserveSafeQuery(queryValues)
  permanentRedirect(`/${locale}${target}${suffix}`)
}
