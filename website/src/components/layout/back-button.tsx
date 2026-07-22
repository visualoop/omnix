'use client'

import { ArrowLeft } from '@phosphor-icons/react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

interface Props {
  fallback?: string
  label?: string
  className?: string
}

/**
 * BackButton — universal "go back" affordance for every detail page.
 *
 * Behaviour: prefers router.back() if there's history, falls back to a
 * provided href when the user landed here via a deep link (history.length
 * is unreliable in Next 15 — we use a heuristic via document.referrer).
 *
 * Renders nothing if we're already at the fallback path.
 */
export function BackButton({ fallback, label = 'Back', className }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  if (pathname === fallback) return null

  function go() {
    const sameOrigin =
      typeof document !== 'undefined' && !!document.referrer && new URL(document.referrer).origin === window.location.origin
    if (sameOrigin) {
      router.back()
    } else if (fallback) {
      router.push(fallback)
    } else {
      router.push('/')
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        'mb-3 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-2 text-[12px] text-[var(--color-fg-muted)] cursor-pointer',
        'transition-[transform,background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] active:scale-[0.97]',
        className,
      )}
      aria-label={label}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
