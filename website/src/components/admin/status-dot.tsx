'use client'

import { motion, useReducedMotion } from 'motion/react'

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
 *
 * Reduced-motion safe: when the viewer prefers reduced motion the breathing
 * halo is dropped entirely (no indefinite animation) and the dot renders
 * static — the colour + glow + `label` still convey the live state.
 *
 * Accessibility: this is a static graphical indicator, not a live status
 * message, so it exposes an accessible name via role="img" rather than
 * a live status role. A live region here would announce on mount (and re-announce
 * on every list re-render) for a dot that never updates in place. Callers that
 * genuinely need an async announcement own their own polite/alert region.
 */
export function StatusDot({ tone, pulse = false, size = 'sm', label }: Props) {
  const color = TONE_COLOR[tone]
  const dim = size === 'sm' ? 8 : 10
  const prefersReducedMotion = useReducedMotion()
  const animate = pulse && !prefersReducedMotion
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{ width: dim + 6, height: dim + 6 }}
      aria-label={label ?? `Status: ${tone}`}
      role="img"
    >
      {animate && (
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
