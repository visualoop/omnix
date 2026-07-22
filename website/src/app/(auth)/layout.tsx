import Link from 'next/link'
import { BRAND_NAME } from '@/lib/brand'
import { BrandWordmark } from '@/components/brand-logo'
import { PageContainer } from '@/components/layout/layout-primitives'
import type { Metadata } from 'next'

/**
 * Layout for /signup, /login, /forgot-password, /verify-email/[token].
 * Suppresses the marketing header/footer; uses a minimal brand bar instead.
 *
 * Root layout (app/layout.tsx) provides html/body/fonts/Tailwind.
 */

// Authentication routes are private acquisition-adjacent surfaces and must
// never be indexed. robots.ts also disallows them — this is defence in depth
// and cascades to every (auth) child page.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)]">
      {/* Keyboard/screen-reader users skip the brand bar straight to the form. */}
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-[var(--radius-pill)] bg-[var(--color-fg)] px-4 py-2 text-[13px] font-semibold text-[var(--color-bg)] focus:not-sr-only"
      >
        Skip to main content
      </a>
      <header className="border-b border-[var(--color-border)]">
        <PageContainer width="wide" className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center"
            aria-label={`${BRAND_NAME} home`}
          >
            <BrandWordmark className="text-[20px]" />
          </Link>
          <Link
            href="/contact"
            className="text-[13px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]"
          >
            Need help?
          </Link>
        </PageContainer>
      </header>

      <main id="main-content" className="flex min-w-0 flex-1 flex-col">{children}</main>

      <footer className="border-t border-[var(--color-border)] py-6">
        <PageContainer width="wide" className="flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--color-fg-subtle)]">
          <span>
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[var(--color-fg)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-fg)]">
              Terms
            </Link>
          </div>
        </PageContainer>
      </footer>
    </div>
  )
}
