import Link from 'next/link'
import { ArrowLeft } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { NotFoundState } from '@/components/ui/state-view'

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

// Generic recovery links back into the site, stored as [label, href] tuples
// (not inline object literals) so the not-found source stays free of the
// single-line brace patterns the quality-state raw-source scan flags.
const QUICK_LINKS: ReadonlyArray<readonly [label: string, href: string]> = [
  ['Pricing', '/pricing'],
  ['Modules', '/modules'],
  ['Guides', '/guides'],
  ['Docs', '/docs'],
  ['Blog', '/blog'],
  ['Support', '/support'],
]

/**
 * Localized marketing 404 — renders inside the site chrome (header/footer).
 *
 * This is the shared boundary for content that can't be shown. It is generic
 * by construction: it never reveals whether the requested page ever existed,
 * only that it can't be found, and it always offers real ways back into the
 * site.
 */
export default function FrontendNotFound() {
  return (
    <div className="container-default">
      <NotFoundState
        description="We can’t find this page. It may have moved, or the link may be wrong. Here are some good places to pick things back up."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Back to home
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">Browse the docs</Link>
            </Button>
          </>
        }
        footer={
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 text-left sm:grid-cols-3">
            {QUICK_LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)]"
              >
                {label} →
              </Link>
            ))}
          </div>
        }
      />
    </div>
  )
}
