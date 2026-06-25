import Link from 'next/link'
import { BRAND_NAME } from '@/lib/brand'
import { BrandWordmark } from '@/components/brand-logo'

/**
 * Layout for /signup, /login, /forgot-password, /verify-email/[token].
 * Suppresses the marketing header/footer; uses a minimal brand bar instead.
 *
 * Root layout (app/layout.tsx) provides html/body/fonts/Tailwind.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 sm:px-8">
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
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-[var(--color-border)] py-6">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 text-[12px] text-[var(--color-fg-subtle)] sm:px-8">
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
        </div>
      </footer>
    </div>
  )
}
