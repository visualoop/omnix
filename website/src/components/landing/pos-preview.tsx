'use client'

import { motion } from 'motion/react'
import { CheckCircle2, ScanLine, Smartphone } from '@/components/icons'

/**
 * Hand-crafted POS preview — stands in for a real product screenshot
 * until the owner uploads one to /admin → LandingPage → hero.screenshot.
 *
 * Built from real Tailwind primitives so it renders crisp at any DPR
 * and respects the brand palette. NOT a 3D laptop mockup.
 */
export function PosPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative isolate"
    >
      {/* Glow */}
      <div
        aria-hidden
        className="absolute -inset-x-12 -inset-y-8 -z-10 rounded-[36px] bg-[radial-gradient(60%_60%_at_50%_50%,var(--color-accent-soft),transparent_70%)] blur-2xl"
      />

      {/* Window chrome */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]/70" />
            <span className="size-2.5 rounded-full bg-[#febc2e]/70" />
            <span className="size-2.5 rounded-full bg-[var(--color-accent)]/70" />
          </div>
          <span className="ml-3 font-mono text-[11px] tracking-wide text-[var(--color-fg-subtle)]">
            Omnix — Westgate branch · Cashier 3
          </span>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-12 gap-0">
          {/* Left rail */}
          <aside className="col-span-3 border-r border-[var(--color-border)] p-4 lg:col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Modules
            </div>
            <nav className="mt-3 space-y-1 text-[12px]">
              {[
                ['POS', true],
                ['Inventory', false],
                ['Banking', false],
                ['HR / Payroll', false],
                ['Reports', false],
                ['Pharmacy', false],
              ].map(([label, active]) => (
                <div
                  key={label as string}
                  className={
                    active
                      ? 'rounded-md bg-[var(--color-accent-soft)] px-2.5 py-1.5 text-[var(--color-accent-hover)]'
                      : 'rounded-md px-2.5 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)]'
                  }
                >
                  {label}
                </div>
              ))}
            </nav>
          </aside>

          {/* Cart */}
          <section className="col-span-9 p-5 lg:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                  Cart · 4 items
                </div>
                <div className="text-[11px] text-[var(--color-fg-subtle)]">
                  Customer · Walk-in
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] text-[var(--color-fg-muted)]"
              >
                <ScanLine className="size-3.5" /> Scan
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {[
                { sku: 'PNDL-500', name: 'Panadol Extra · 500mg ×2', qty: '2', total: '120' },
                { sku: 'AMOX-250', name: 'Amoxil · 250mg cap ×10', qty: '1', total: '320' },
                { sku: 'BANDA', name: 'Elastoplast roll · 5cm', qty: '3', total: '450' },
                { sku: 'WATER', name: 'Quencher water · 500ml', qty: '6', total: '300' },
              ].map((item) => (
                <li
                  key={item.sku}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-[12px]"
                >
                  <div className="flex flex-col">
                    <span className="text-[var(--color-fg)]">{item.name}</span>
                    <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                      {item.sku} · qty {item.qty}
                    </span>
                  </div>
                  <span className="font-mono font-medium tabular-nums text-[var(--color-fg)]">
                    KES {item.total}
                  </span>
                </li>
              ))}
            </ul>

            {/* Totals */}
            <div className="mt-5 space-y-1.5 border-t border-[var(--color-border)] pt-4 text-[12px]">
              <Row label="Subtotal" value="KES 1,190" />
              <Row label="VAT (16%)" value="KES 190.40" muted />
              <Row label="Total" value="KES 1,380.40" bold />
            </div>
          </section>

          {/* Payment column */}
          <aside className="col-span-12 border-t border-[var(--color-border)] p-5 lg:col-span-3 lg:border-l lg:border-t-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Payment
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-3.5 text-[var(--color-accent-hover)]" />
                  <span className="text-[11px] font-medium text-[var(--color-accent-hover)]">
                    M-Pesa STK
                  </span>
                </div>
                <div className="mt-1 font-mono text-[14px] text-[var(--color-fg)]">
                  +254 712 345 678
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-fg-muted)]">
                  <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-positive)]" />
                  Awaiting confirmation…
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-[11px] text-[var(--color-fg-subtle)]">
                Cash · Card
              </div>
            </div>

            <button
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-2.5 text-[12px] font-medium text-[var(--color-accent-foreground)]"
              tabIndex={-1}
            >
              <CheckCircle2 className="size-3.5" /> Complete sale
            </button>

            <div className="mt-3 text-center font-mono text-[10px] text-[var(--color-fg-subtle)]">
              eTIMS receipt will print
            </div>
          </aside>
        </div>
      </div>

      {/* Floating chip badges */}
      <FloatingChip label="Offline-ready" className="-left-3 top-12 sm:left-2 lg:-left-12" />
      <FloatingChip
        label="eTIMS · M-Pesa"
        className="-right-2 bottom-12 sm:right-4 lg:-right-12"
      />
    </motion.div>
  )
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string
  value: string
  muted?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={muted ? 'text-[var(--color-fg-subtle)]' : 'text-[var(--color-fg-muted)]'}>
        {label}
      </span>
      <span
        className={
          bold
            ? 'font-mono text-[14px] font-semibold tabular-nums text-[var(--color-fg)]'
            : 'font-mono tabular-nums text-[var(--color-fg-muted)]'
        }
      >
        {value}
      </span>
    </div>
  )
}

function FloatingChip({ label, className }: { label: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className={`absolute hidden items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-fg)] shadow-lg shadow-black/40 sm:inline-flex ${className ?? ''}`}
    >
      <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
      {label}
    </motion.div>
  )
}
