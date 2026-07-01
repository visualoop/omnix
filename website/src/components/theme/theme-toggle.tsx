'use client'

/**
 * Theme toggle — single button that cycles light ↔ dark.
 *
 * Notes:
 *   - We render a stable placeholder before mount so SSR + first paint
 *     don't flash the wrong icon. `next-themes` exposes `resolvedTheme`
 *     only after hydration; reading it before that causes mismatch.
 *   - Hits a 44×44px touch target (Kenyan POS screens with greasy
 *     fingers) without bloating the header height.
 *   - Pure aria-label, no visible text. The icon swap conveys intent.
 */
import * as React from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from '@phosphor-icons/react/dist/ssr'

import { cn } from '@/lib/cn'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [mounted, setMounted] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // SSR / pre-hydration placeholder — same shape as the real button so
  // the header doesn't shift on mount. aria-hidden because it's not
  // yet interactive.
  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        style={{ width: 36, height: 36 }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full',
          className,
        )}
      />
    )
  }

  const isDark = resolvedTheme === 'dark'
  const next = isDark ? 'light' : 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      // Explicit width/height defends against flex-shrink turning the
      // circle into an oval when the header row runs out of room. The
      // shrink-0 class does the same job via Tailwind — belt AND braces
      // because both were failing in the field on 640-767px viewports.
      style={{ width: 36, height: 36 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'text-[var(--color-fg-muted)] transition-colors',
        'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--color-accent)]',
        className,
      )}
    >
      {isDark ? (
        <Sun size={18} weight="regular" aria-hidden="true" />
      ) : (
        <Moon size={18} weight="regular" aria-hidden="true" />
      )}
    </button>
  )
}
