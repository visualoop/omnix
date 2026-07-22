/**
 * buildClearHref — construct the "Clear filters" destination for a
 * {@link FilteredEmptyState} clear link.
 *
 * A filtered list that matched nothing must always offer a one-click way
 * back to the un-filtered list. On a simple top-level list that is just the
 * base path. On a detail page with several independent tabs (each with its
 * own namespaced `q` + `page` params) the clear link must:
 *   - keep the current route,
 *   - keep the open tab (`set: { tab }`) and every *other* tab's search/page
 *     state (so clearing the Licences filter doesn't reset the Machines tab),
 *   - drop only *this* list's filter + page namespace.
 *
 * Server component friendly: it takes the already-awaited `searchParams`
 * object and returns a plain string href, so it can be handed straight to a
 * server-rendered <Link>.
 */
export function buildClearHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  options: { drop: string[]; set?: Record<string, string> },
): string {
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(searchParams)) {
    if (options.drop.includes(key)) continue
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value == null || value === '') continue
    params.set(key, value)
  }
  if (options.set) {
    for (const [key, value] of Object.entries(options.set)) {
      if (value) params.set(key, value)
    }
  }
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
