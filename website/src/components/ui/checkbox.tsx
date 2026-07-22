'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from '@phosphor-icons/react'

import { cn } from '@/lib/cn'

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="checkbox"
      className={cn(
        'peer inline-flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-white outline-none',
        'transition-[transform,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.94]',
        'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
        'data-[state=checked]:border-[var(--color-accent)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:hover:bg-[var(--color-accent-hover)]',
        'aria-invalid:border-[var(--color-negative)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:active:scale-100',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" weight="bold" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})

Checkbox.displayName = 'Checkbox'
