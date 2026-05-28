import Link from 'next/link'
import { ArrowLeft } from '@/components/icons'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-128px)] items-center justify-center px-6 py-20">
      <div className="text-center">
        <div className="font-mono text-[14px] font-semibold tabular-nums text-[var(--color-accent)]">
          404
        </div>
        <h1 className="mt-4 font-display text-[clamp(40px,6vw,72px)] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-fg)]">
          Page not found.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-balance text-[16px] leading-[1.55] text-[var(--color-fg-muted)]">
          The page you were looking for doesn't exist, or has moved. The most useful next steps
          are below.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs">Browse the docs</Link>
          </Button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
          {[
            { label: 'Pricing', href: '/pricing' },
            { label: 'Modules', href: '/modules' },
            { label: 'Downloads', href: '/downloads' },
            { label: 'Changelog', href: '/changelog' },
            { label: 'About', href: '/about' },
            { label: 'Blog', href: '/blog' },
            { label: 'Contact', href: '/contact' },
            { label: 'Support', href: '/support' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)]"
            >
              {link.label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
