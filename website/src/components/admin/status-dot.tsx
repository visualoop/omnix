'use client'

import { motion } from 'motion/react'

type Tone = 'live' | 'recent' | 'idle' | 'down' | 'positive' | 'caution' | 'negative' | 'neutral'

interface Props {
  tone: Tone
  pulse?: boolean
  size?: 'sm' | 'md'
  label?: string
}

const TONE_COLOR: Record<Tone, string> = {
  live:      'var(--color-accent)',
  recent:    'var(--color-positive)',
  idle:      'var(--color-fg-subtle)',
  down:      'var(--color-negative)',
  positive:  'var(--color-positive)',
  caution:   'var(--color-caution)',
  negative:  'var(--color-negative)',
  neutral:   'var(--color-fg-subtle)',
}

/**
 * StatusDot — a coloured LED. Use `pulse` for live machines so the dot
 * breathes; everywhere else, a static dot. Pair with a label for screen
 * readers via the `label` prop.
 */
export function StatusDot({ tone, pulse = false, size = 'sm', label }: Props) {
  const color = TONE_COLOR[tone]
  const dim = size === 'sm' ? 8 : 10
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{ width: dim + 6, height: dim + 6 }}
      aria-label={label ?? `Status: ${tone}`}
      role="status"
    >
      {pulse && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color, opacity: 0.25 }}
          animate={{ scale: [1, 2.2, 1], opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span
        className="rounded-full"
        style={{
          width: dim,
          height: dim,
          background: color,
          boxShadow: pulse ? `0 0 6px ${color}` : 'none',
        }}
      />
    </span>
  )
}
