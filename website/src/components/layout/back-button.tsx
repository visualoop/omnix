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
        'inline-flex items-center gap-1.5 -ml-2 mb-3 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] rounded-md cursor-pointer transition-colors',
        className,
      )}
      aria-label={label}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
