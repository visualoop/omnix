'use client'

/**
 * Editorial mobile sheet — Radix Dialog portaled to <body>, sliding in
 * from the right at 85vw / max 24rem. Full backdrop-blur overlay.
 *
 * Pattern lifted from the zebra-trails-safari project — clean full-height
 * panel with a masthead bar, generous display-font nav links, and a foot
 * containing secondary controls (theme, currency, primary CTA).
 *
 * Why not the previous inline fixed div? Two reasons:
 *   1. z-index conflict — the old panel rendered at z-40 while the header
 *      sat at z-50, so the drawer disappeared behind the sticky header on
 *      some viewports.
 *   2. Focus + scroll trap — Radix Dialog handles both correctly (locks
 *      body scroll, traps focus, restores focus on close, escape key,
 *      inert siblings). The old panel only patched body scroll.
 */
import * as Dialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react/dist/ssr'
import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: ReactNode
  /** Accessible title — screen-reader only unless a `<SheetTitle>` is rendered. */
  ariaLabel?: string
  /** side="right" (default) or side="left". */
  side?: 'left' | 'right'
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  children,
  ariaLabel = 'Navigation menu',
  side = 'right',
  className,
}: SheetProps) {
  const slideStart = side === 'right' ? 'translate-x-full' : '-translate-x-full'
  const anchorSide = side === 'right' ? 'right-0' : 'left-0'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'motion-reduce:animate-none',
          )}
        />
        <Dialog.Content
          aria-label={ariaLabel}
          className={cn(
            'fixed inset-y-0 z-[71] flex flex-col',
            'w-[85vw] max-w-[24rem]',
            'bg-[var(--color-bg)] shadow-[-8px_0_30px_rgba(0,0,0,0.15)]',
            anchorSide,
            // Radix state-based animations. Tailwind 3+ ships these
            // utilities via `tailwindcss-animate` (already in deps).
            side === 'right'
              ? 'data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right'
              : 'data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left',
            'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            'motion-reduce:animate-none',
            `data-[state=closed]:${slideStart}`, // no-op with animate-out but keeps semantics
            className,
          )}
        >
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SheetClose({ className }: { className?: string }) {
  return (
    <Dialog.Close
      aria-label="Close menu"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-md',
        'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        'transition-colors',
        className,
      )}
    >
      <X className="size-5" weight="regular" />
    </Dialog.Close>
  )
}
