import * as React from 'react'

import { PageContainer } from '@/components/layout/layout-primitives'

export interface AuthAsideItem {
  term: string
  detail: string
}

interface AuthFrameProps {
  children: React.ReactNode
  description: React.ReactNode
  eyebrow: string
  title: string
  /**
   * The "how access works" side panel. Defaults to the passwordless
   * security model. Pass `null` to hide it (single-column layout).
   */
  aside?: AuthAsideItem[] | null
  asideLabel?: string
  /** Optional row rendered under the form (links, alternate actions). */
  footer?: React.ReactNode
}

const DEFAULT_ASIDE: AuthAsideItem[] = [
  { term: 'One-time link', detail: 'Expires 15 minutes after it is issued.' },
  { term: 'Verified identity', detail: 'Google or your email inbox confirms it is you.' },
  { term: 'Safe return', detail: 'After sign-in, Omnix returns only to a page on this site.' },
]

/**
 * Shared access-desk frame for every passwordless account route
 * (sign in, recover access, verify, accept invitation, session states).
 *
 * Renders inside the (auth) layout main landmark — it must not introduce a
 * second landmark of that kind. Working Counter system: light-first, one
 * copper accent, rounded controls, restrained motion. Responsive single
 * column → form/aside split at lg.
 */
export function AuthFrame({
  children,
  description,
  eyebrow,
  title,
  aside = DEFAULT_ASIDE,
  asideLabel = 'How access works',
  footer,
}: AuthFrameProps) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] min-w-0 items-center py-10 sm:py-14">
      <PageContainer width="text">
        <div className="mx-auto grid min-w-0 max-w-3xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] lg:grid-cols-[minmax(0,1fr)_15rem]">
          <section className="min-w-0 bg-[var(--color-bg)] px-5 py-7 sm:px-8 sm:py-9">
            <header className="mb-7 border-b border-[var(--color-border)] pb-6">
              <p className="eyebrow-plain">{eyebrow}</p>
              <h1 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-fg)]">
                {title}
              </h1>
              <div className="mt-3 max-w-[55ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
                {description}
              </div>
            </header>

            {children}

            {footer ? (
              <div className="mt-7 border-t border-[var(--color-border)] pt-5 text-[13px] leading-6 text-[var(--color-fg-muted)]">
                {footer}
              </div>
            ) : null}
          </section>

          {aside ? (
            <aside
              aria-label={asideLabel}
              className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-7 sm:px-8 lg:border-l lg:border-t-0 lg:px-6 lg:py-9"
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                {asideLabel}
              </p>
              <dl className="mt-5 grid gap-5 text-[12px] leading-5 sm:grid-cols-3 lg:grid-cols-1">
                {aside.map((item) => (
                  <div key={item.term}>
                    <dt className="font-ui font-semibold text-[var(--color-fg)]">{item.term}</dt>
                    <dd className="mt-1 text-[var(--color-fg-muted)]">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : null}
        </div>
      </PageContainer>
    </div>
  )
}
