'use client'

import { motion } from 'motion/react'

interface Props {
  live: number
  total: number
}

/**
 * Sidebar pulse — a small heartbeat dot + count, communicating
 * "system is breathing" at all times. The glow scale loops every
 * 2.4s; the dot itself stays solid. Counts the actual machines
 * online in the last 5 minutes.
 */
export function SystemPulse({ live, total }: Props) {
  const isQuiet = live === 0
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="relative inline-grid place-items-center size-3">
        {!isQuiet && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--color-accent-glow)' }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className="size-2 rounded-full"
          style={{
            background: isQuiet ? 'var(--color-fg-subtle)' : 'var(--color-accent)',
            boxShadow: isQuiet ? 'none' : '0 0 8px var(--color-accent-glow)',
          }}
        />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[11px] tabular-nums leading-none text-[var(--color-fg)]">
          {live}/{total}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)] mt-1">
          machines live
        </div>
      </div>
    </div>
  )
}
