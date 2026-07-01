'use client'

import { motion } from 'motion/react'
import { OfflineIllo, SecurityIllo, UpdatesIllo, SyncIllo } from '@/components/marketing/illustrations'

/**
 * Reliability & data safety.
 *
 * Buyer question: "Can I trust this with my livelihood for the next decade?"
 * The single biggest enterprise trust gap on the old site. We answer the four
 * fears an owner has about depending on software: it'll break when offline,
 * I'll lose my data, it'll go stale, and it won't scale past one machine.
 * Each is a real architectural fact about Omnix, stated plainly.
 */
const PILLARS = [
  {
    Illo: OfflineIllo,
    title: 'Offline-first, by design',
    body: 'Omnix is a native desktop app with its own local database — not a website that needs a connection. Power and internet can both drop; the business keeps trading. Everything syncs the moment the line returns.',
  },
  {
    Illo: SecurityIllo,
    title: 'Your data is encrypted and yours',
    body: 'The database lives on your own machine under your Windows account. No cloud holds your books hostage. Encrypted backups (both local and to your cloud bucket) mean a stolen or dead PC never means a lost business — restore to a new machine with your licence key.',
  },
  {
    Illo: UpdatesIllo,
    title: 'It improves while you sleep',
    body: 'Signed updates download quietly and install when you close the app — like a modern editor. New features, KRA changes, and fixes arrive without a technician visit or a reinstall.',
  },
  {
    Illo: SyncIllo,
    title: 'Grows from one till to many',
    body: 'Start on a single PC. Add more terminals on the same network when you need them — they share live stock and sales over your LAN, with no monthly per-seat fee and no internet dependency.',
  },
]

export function ReliabilitySection() {
  return (
    <section className="section bg-[var(--color-surface)]/40 border-y border-[var(--color-border)]">
      <div className="container-wide">
        <div className="max-w-[680px]">
          <span className="eyebrow">Trust &amp; reliability</span>
          <h2 className="headline-section mt-5 text-balance">
            Software you can <em>depend on</em> for years.
          </h2>
          <p className="lede mt-7 text-balance">
            You&rsquo;re not buying a tool for this month. You&rsquo;re choosing
            what your business will run on for the next decade. Here&rsquo;s why
            that&rsquo;s a safe bet.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-x-20 lg:gap-y-16">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className="flex gap-5"
            >
              <span className="mt-1 shrink-0 text-[var(--color-accent)]">
                <p.Illo size={40} />
              </span>
              <div>
                <h3 className="headline-sub text-[22px]">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[46ch]">
                  {p.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
