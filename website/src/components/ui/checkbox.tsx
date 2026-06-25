'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from '@phosphor-icons/react'

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

/**
 * Editorial Checkbox — Radix-backed.
 *
 *   <Checkbox checked={x} onCheckedChange={setX} />
 *   <Checkbox defaultChecked name="optIn" />  // form-driven
 *
 * 16×16 box, 1px border, 3px corner radius. Accent on check.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function CheckboxImpl({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30',
        'data-[state=checked]:border-[var(--color-accent)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:text-white',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        'hover:border-[var(--color-border-strong)] data-[state=checked]:hover:bg-[var(--color-accent-hover,var(--color-accent))]',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3" weight="bold" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
