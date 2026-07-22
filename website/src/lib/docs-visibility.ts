import type { DocSeed } from '@/lib/docs-seed'

/**
 * Doc visibility — a single source of truth for which seed docs are
 * publishable versus still-placeholder scaffolds (or explicitly retired).
 *
 * The docs seed ships fully-written guides plus scaffolds whose body is
 * generated with a "TODO: document this." marker. A scaffold keeps its
 * route so existing links never 404, but it must not be listed on /docs,
 * must not appear in the sitemap, and must be noindex on its detail page —
 * otherwise placeholder content leaks into search results.
 *
 * Separately, a small set of legacy docs shipped with real, written bodies
 * that we no longer want on the public product surface (the in-app AI
 * assistant is not part of the public positioning). Deleting them would
 * break old inbound links, so instead they are excluded here by slug: they
 * keep their route but fail closed everywhere a doc is published — the index,
 * the sitemap, and the detail page.
 *
 * This is a read-only classifier; it does not mutate the seed data, so the
 * Payload/seed content behaviour (and the internal desktop docs enum) is
 * preserved exactly.
 */
export const DOC_PLACEHOLDER_MARKER = 'TODO: document this.'

/**
 * Legacy docs retired from the public surface. Their bodies are real (not
 * TODO scaffolds), so only an explicit slug exclusion keeps them out of the
 * public index/sitemap/detail. The route is intentionally kept alive for old
 * links (it simply 404s via the detail page's fail-closed guard).
 */
export const LEGACY_EXCLUDED_DOC_SLUGS = ['ai', 'ai-keys'] as const

/** True when a slug is on the legacy public-exclusion list. */
export function isLegacyExcludedDocSlug(slug: string | null | undefined): boolean {
  return typeof slug === 'string' && (LEGACY_EXCLUDED_DOC_SLUGS as readonly string[]).includes(slug)
}

/** True when the doc body is still an unwritten scaffold. */
export function isDocPlaceholder(doc: Pick<DocSeed, 'body'>): boolean {
  return doc.body.includes(DOC_PLACEHOLDER_MARKER)
}

/**
 * True when the doc has real, publishable content AND is not on the legacy
 * public-exclusion list.
 *
 * Accepts a doc with a required `body` and an OPTIONAL `slug`. Body-only
 * callers (unit tests, ad-hoc classification) work unchanged: with no slug
 * the exclusion list simply never matches. Seed rows (which always carry a
 * slug) additionally fail closed for the legacy exclusions. This also keeps
 * `DOCS_SEED.filter(isPublishedDoc)` valid — only the first argument is read,
 * so the array `index`/`array` predicate arguments are ignored.
 */
export function isPublishedDoc(
  doc: Pick<DocSeed, 'body'> & Partial<Pick<DocSeed, 'slug'>>,
): boolean {
  if (isLegacyExcludedDocSlug(doc.slug)) return false
  return !isDocPlaceholder(doc)
}
