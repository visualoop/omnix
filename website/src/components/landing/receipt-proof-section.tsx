'use client'

import { motion } from 'motion/react'
import { Icon } from '@/components/icons'

/**
 * "The receipt is the proof" — single proof section.
 *
 * Visualises the heart of the product's compliance promise:
 * the receipt the cashier prints IS the entry KRA reads.
 *
 * Surface bumps to --color-surface-2 (one notch deeper than page bg)
 * to mark it as a different beat per hierarchy-rhythm skill.
 *
 * Two hand-built panels (NOT screenshots) side-by-side, joined by a
 * thin accent rule that says "→ filed". Hung italic caption below.
 */
export function ReceiptProofSection() {
  return (
    <section
      className="section relative overflow-hidden"
      style={{ background: 'var(--color-surface-2)' }}
    >
      {/* Subtle tonal bump — soft accent pool top-centre */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_72%)] blur-3xl"
      />

      <div className="container-wide relative">
        <div className="mx-auto max-w-[44rem] text-center">
          <span className="eyebrow mx-auto w-fit">The receipt is the proof</span>
          <h2 className="headline-section mt-6 text-balance">
            What you ring up is <em>what KRA sees.</em>
          </h2>
          <p className="lede mx-auto mt-7 text-balance">
            Every Omnix sale prints a real eTIMS receipt with a KRA control unit signature. The
            same row lands on KRA&rsquo;s line in the same minute. No batch upload, no
            month-end scramble, no &ldquo;sync now&rdquo; button to forget.
          </p>
        </div>

        {/* The two panels */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.65 }}
          className="relative mx-auto mt-20 grid max-w-[1180px] grid-cols-1 gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:gap-0"
        >
          {/* Left — receipt */}
          <ReceiptPanel />

          {/* Connector — only on desktop */}
          <div className="hidden items-center justify-center lg:flex">
            <div className="flex flex-col items-center gap-3 px-8">
              <div className="hairline-accent rotate-90 origin-center w-12" />
              <span className="caption-mono whitespace-nowrap">filed in real time</span>
              <Icon.ArrowRight
                className="size-4 text-[var(--color-accent)]"
                weight="bold"
              />
              <div className="hairline-accent rotate-90 origin-center w-12" />
            </div>
          </div>

          {/* Right — KRA filing */}
          <KraFilingPanel />
        </motion.div>

        {/* Hung italic caption below */}
        <div className="mx-auto mt-16 max-w-[760px]">
          <p
            className="font-[family-name:var(--font-display)] text-[26px] italic font-light leading-snug text-[var(--color-fg-muted)] sm:text-[30px]"
            style={{ textIndent: '-0.5em', paddingLeft: '0.5em' }}
          >
            &ldquo;The first month I switched to Omnix, I stopped staying back to file
            returns. KRA had already read what I rang up.&rdquo;
          </p>
          <div className="caption-mono mt-5">
            Naliaka — pharmacy owner, Westlands
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Hand-built receipt panel — printer-paper proportions, mono type.
 * ───────────────────────────────────────────────────────────── */
function ReceiptPanel() {
  return (
    <div className="relative">
      <div className="caption-mono mb-4">Cashier till · Receipt #00248</div>

      <div className="relative rounded-[2px] border border-[var(--color-border-strong)] bg-[var(--color-fg)] p-7 font-[family-name:var(--font-mono)] text-[12px] leading-[1.7] text-[#1F1A14]">
        <div className="text-center">
          <div className="text-[14px] font-semibold tracking-[0.05em]">OMNIX PHARMACY</div>
          <div className="text-[10px] tracking-[0.18em] uppercase opacity-60">
            Westlands · Nairobi
          </div>
          <div className="text-[10px] tracking-[0.18em] uppercase opacity-60">
            P051234567X
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-[#1F1A14]/30" />

        <ul className="space-y-1.5">
          <ReceiptRow name="Panadol Extra ×2" qty="2" total="120.00" />
          <ReceiptRow name="Amoxil 250mg ×10" qty="1" total="320.00" />
          <ReceiptRow name="Elastoplast 5cm" qty="3" total="450.00" />
          <ReceiptRow name="Quencher water" qty="6" total="300.00" />
        </ul>

        <div className="my-3 border-t border-dashed border-[#1F1A14]/30" />

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="opacity-70">Subtotal</span>
            <span>1,190.00</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">VAT 16%</span>
            <span>190.40</span>
          </div>
          <div className="mt-1 flex justify-between text-[14px] font-semibold">
            <span>TOTAL KES</span>
            <span>1,380.40</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-[#1F1A14]/30" />

        <div className="text-[10px] leading-[1.65] tracking-[0.04em] opacity-80">
          <div>PAID · M-Pesa STK · NHM48ZK21A</div>
          <div className="mt-2">
            <span className="opacity-60">eTIMS CU</span>{' '}
            <span className="font-semibold">KRACU0100009873</span>
          </div>
          <div>
            <span className="opacity-60">CU Inv No.</span>{' '}
            <span className="font-semibold">0100009873000248</span>
          </div>
          <div>
            <span className="opacity-60">Signed</span>{' '}
            <span className="break-all font-semibold">8K3-FN2-9HD-PQ4</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-[#1F1A14]/30" />

        <div className="text-center text-[10px] tracking-[0.18em] uppercase opacity-60">
          Thank you · 2026-05-22 14:32
        </div>

        {/* Tear-edge bottom */}
        <div
          aria-hidden
          className="absolute -bottom-2 left-0 right-0 h-2"
          style={{
            backgroundImage:
              'linear-gradient(135deg, var(--color-fg) 25%, transparent 25%), linear-gradient(225deg, var(--color-fg) 25%, transparent 25%)',
            backgroundSize: '12px 12px',
            backgroundPosition: '0 0, 0 0',
          }}
        />
      </div>
    </div>
  )
}

function ReceiptRow({
  name,
  qty,
  total,
}: {
  name: string
  qty: string
  total: string
}) {
  return (
    <li className="flex justify-between gap-4">
      <span className="flex-1 truncate">{name}</span>
      <span className="opacity-60">×{qty}</span>
      <span className="w-20 text-end tabular-nums">{total}</span>
    </li>
  )
}

/* ─────────────────────────────────────────────────────────────
 * KRA filing panel — government dashboard simulacrum.
 * Same data row appearing in KRA's eTIMS portal in real time.
 * ───────────────────────────────────────────────────────────── */
function KraFilingPanel() {
  return (
    <div>
      <div className="caption-mono mb-4">KRA eTIMS portal · Filed</div>

      <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6">
        {/* Portal header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
          <div>
            <div className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Kenya Revenue Authority
            </div>
            <div className="font-[family-name:var(--font-display)] mt-1 text-[16px] font-medium text-[var(--color-fg)]">
              eTIMS Online · Invoice register
            </div>
          </div>
          <div className="caption-mono">PIN P051234567X</div>
        </div>

        {/* Filing row */}
        <div className="mt-5">
          <div className="caption-mono mb-3">22 May 2026 · 14:32:18 EAT</div>
          <div className="rounded-md border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/8 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="size-2 rounded-full bg-[var(--color-positive)]" />
                <span className="font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-positive)]">
                  Accepted
                </span>
              </div>
              <span className="caption-mono">2.4 s after print</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[12px] font-[family-name:var(--font-mono)]">
              <dt className="text-[var(--color-fg-subtle)]">CU number</dt>
              <dd className="text-end text-[var(--color-fg)]">KRACU0100009873</dd>
              <dt className="text-[var(--color-fg-subtle)]">CU invoice</dt>
              <dd className="text-end text-[var(--color-fg)]">0100009873000248</dd>
              <dt className="text-[var(--color-fg-subtle)]">Total VAT</dt>
              <dd className="text-end text-[var(--color-fg)]">KES 190.40</dd>
              <dt className="text-[var(--color-fg-subtle)]">Total invoice</dt>
              <dd className="text-end text-[var(--color-fg)]">KES 1,380.40</dd>
              <dt className="text-[var(--color-fg-subtle)]">Signature</dt>
              <dd className="text-end text-[var(--color-fg)] truncate">
                8K3-FN2-9HD-PQ4
              </dd>
            </dl>
          </div>
        </div>

        {/* Subtle "and 247 more today" footnote */}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="caption-mono">Today · 248 invoices · 0 rejects</span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-fg-subtle)]">
            P9: filed
          </span>
        </div>
      </div>
    </div>
  )
}
