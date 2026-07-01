'use client'

/**
 * Sticky bottom-right CTA — appears after the viewer scrolls past the
 * hero, hides again when the closing CTA enters view. Solves the "the
 * purchase button is 14 scrolls away from the moment they said 'I love
 * this'" problem.
 *
 * Design:
 *   - Bottom-right, above the WhatsApp float (which is bottom-left).
 *   - Cream card with hairline border-strong; primary CTA button in
 *     accent, small price caption underneath in mono 11px.
 *   - Slides up + fades on entry, slides down + fades on exit.
 *   - Hidden on mobile below 640px — the mobile hamburger + primary
 *     Start Trial button already covers the same need without eating
 *     screen real estate.
 *   - Respects prefers-reduced-motion.
 */
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/icons'

interface Props {
  /** e.g. "KES 30,000 once" — matches the caption under the hero primary CTA. */
  priceCaption?: string
  /** Where the button navigates. Defaults to /signup. */
  href?: string
  /** Button label. Defaults to "Start free trial". */
  ctaLabel?: string
}

export function StickyBuyCta({
  priceCaption = 'KES 30,000 once',
  href = '/signup',
  ctaLabel = 'Start free trial',
}: Props) {
  const [visible, setVisible] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    // Show when the user has scrolled past ~1.2× the hero height (~800px
    // on desktop, ~600px on mobile). Hide when the ClosingCtaSection
    // enters view (its element has a `data-closing-cta` marker below).
    let visibleNow = false
    const HERO_SCROLL_THRESHOLD = 700

    const updateFromScroll = () => {
      const scrolled = window.scrollY > HERO_SCROLL_THRESHOLD
      // Hide when the ClosingCtaSection is within 300px of the viewport.
      const closing = document.querySelector('[data-closing-cta]') as HTMLElement | null
      const closingVisible = closing
        ? closing.getBoundingClientRect().top < window.innerHeight - 100
        : false
      const next = scrolled && !closingVisible
      if (next !== visibleNow) {
        visibleNow = next
        setVisible(next)
      }
    }

    updateFromScroll()
    window.addEventListener('scroll', updateFromScroll, { passive: true })
    window.addEventListener('resize', updateFromScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateFromScroll)
      window.removeEventListener('resize', updateFromScroll)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="hidden sm:block fixed bottom-6 right-6 z-40"
        >
          <Link
            href={href}
            aria-label={`${ctaLabel} — ${priceCaption}`}
            className="group flex items-stretch gap-3 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-2 pl-4 pr-2 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.16)] backdrop-blur-md transition-shadow hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.24)]"
          >
            <div className="flex flex-col justify-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                Ready when you are
              </span>
              <span className="font-[family-name:var(--font-ui)] text-[13px] font-medium text-[var(--color-fg)] leading-tight mt-0.5">
                {priceCaption}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 text-[13px] font-medium text-[var(--color-accent-foreground)] transition-transform group-hover:translate-x-[1px]">
              {ctaLabel}
              <Icon.ArrowRight className="size-3.5" weight="bold" />
            </span>
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
