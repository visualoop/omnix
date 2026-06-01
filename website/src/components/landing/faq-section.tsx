'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * FAQ — accordion with Fraunces 22px questions.
 *
 * Per OMNIX-BRIEF §6.1 ⑪:
 *   - 8 honest questions
 *   - question typeset Fraunces 22px regular
 *   - plus glyph rotates to × on open (no chevron)
 *   - one open at a time
 *   - 1px hairline between rows
 *
 * Uses native disclosure behaviour (one-at-a-time controlled state) instead of
 * shadcn accordion so the styling is fully editorial.
 */

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What does the one-time payment actually cover?',
    a: 'KES 100,000 buys a perpetual licence for Core ERP plus every trade module you select. You receive every minor and patch release within the same major version for free, and one year of priority support. There is no remote kill switch on a paid licence.',
  },
  {
    q: 'Do I need internet to run Omnix?',
    a: 'No. POS, inventory, payroll, banking — all run locally on the Windows machine. You only need internet for syncing across branches, M-Pesa STK, eTIMS submission, and updates. When the line drops, the till keeps ringing; everything reconciles the moment you reconnect.',
  },
  {
    q: 'Is there a refund policy?',
    a: 'You get 30 days free to try every module before you pay anything. If you pay and decide within 14 days that Omnix is not the right fit, we refund the full amount minus the Paystack processing fee — no questions asked.',
  },
  {
    q: 'Can I move my licence to a new computer?',
    a: 'Yes. Each licence covers up to 10 machines. Deactivate the old machine from your dashboard, and the next install picks up the slot. We never hardware-lock a licence in a way that punishes a routine swap.',
  },
  {
    q: 'What if I add a new branch later?',
    a: 'A second-and-onward branch is a one-time KES 15,000 upgrade. Your existing licence absorbs the new branch — there is no separate account to manage. Extra machine seats are KES 5,000 each.',
  },
  {
    q: 'How does cloud backup work?',
    a: 'Optional add-on at KES 500 per month per branch. Each night an encrypted snapshot of your local database uploads to Cloudflare R2 storage we operate from London. If your machine is lost, you reinstall Omnix and restore the snapshot in minutes. The encryption key never leaves your hands.',
  },
  {
    q: 'Do you offer discounts for cooperatives, NGOs, or schools?',
    a: 'Yes. Email sales@omnix.co.ke with your registration documents and we honour 25% off the licence fee. The same rate applies to agricultural cooperatives, registered NGOs, and accredited schools.',
  },
  {
    q: 'How long does setup take?',
    a: 'A single-shop setup takes about 30 minutes from download to first sale: install, sign in to your trial, import your product list (Excel, CSV, or barcode-scan), and you are ringing up sales. Multi-branch setups take longer because they need master / client networking and per-branch eTIMS verification.',
  },
]

export function FaqSection() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0)

  return (
    <section className="section">
      <div className="container-default">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Section header — sticky on the side */}
          <div className="lg:col-span-4">
            <span className="eyebrow">Honest answers</span>
            <h2 className="headline-section mt-5 text-balance">
              What people ask <em>before they buy.</em>
            </h2>
            <p className="lede mt-7 max-w-[34ch]">
              No copy-paste FAQ. These are the questions we hear on the phone every week.
            </p>
          </div>

          {/* Accordion */}
          <ol className="lg:col-span-8">
            {FAQS.map((item, i) => {
              const open = openIdx === i
              return (
                <li
                  key={item.q}
                  className={
                    i === FAQS.length - 1
                      ? 'border-y border-[var(--color-border)]'
                      : 'border-t border-[var(--color-border)]'
                  }
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-6 py-7 text-left transition-colors hover:bg-[var(--color-surface)]/40"
                  >
                    <span
                      className={cn(
                        'font-[family-name:var(--font-display)] text-[clamp(20px,1.6vw,24px)] font-normal leading-[1.3] tracking-[-0.014em]',
                        open ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]',
                      )}
                    >
                      {item.q}
                    </span>
                    <PlusGlyph open={open} />
                  </button>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        key="content"
                        id={`faq-panel-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.21, 0.47, 0.32, 0.98] }}
                        className="overflow-hidden"
                      >
                        <p className="pb-8 pr-12 text-[16px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/** Plus glyph that rotates 45° to become × when open. */
function PlusGlyph({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex size-7 shrink-0 items-center justify-center transition-colors',
        open ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-subtle)] group-hover:text-[var(--color-fg)]',
      )}
    >
      {/* Horizontal line — always visible */}
      <span
        className={cn(
          'absolute h-px w-4 bg-current transition-transform duration-300',
          open ? 'rotate-45' : 'rotate-0',
        )}
      />
      {/* Vertical line — rotates to merge with horizontal at 45deg */}
      <span
        className={cn(
          'absolute h-4 w-px bg-current transition-transform duration-300',
          open ? '-rotate-45' : 'rotate-0',
        )}
      />
    </span>
  )
}
