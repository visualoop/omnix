import Link from 'next/link'
import { ArrowLeft } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { NotFoundState } from '@/components/ui/state-view'

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

const QUICK_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Modules', href: '/modules' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
  { label: 'Support', href: '/support' },
]

export default function NotFound() {
  return (
    <main id="main-content" className="px-6">
      <NotFoundState
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
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)]"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        }
      />
    </main>
  )
}
