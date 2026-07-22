import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-pill)] font-ui text-sm font-semibold whitespace-nowrap outline-none transition-[transform,background-color,border-color,color,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 aria-invalid:ring-2 aria-invalid:ring-[color:var(--color-negative)]/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:bg-[var(--color-accent-hover)]',
        destructive:
          'bg-[var(--color-negative)] text-white hover:opacity-90 focus-visible:outline-[var(--color-negative)]',
        outline:
          'border border-[var(--color-border-strong)] bg-transparent text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)] hover:bg-[var(--color-surface)]',
        secondary:
          'bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]',
        ghost:
          'bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]',
        link:
          'h-auto rounded-none bg-transparent p-0 text-[var(--color-accent)] underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-11 px-5 has-[>svg]:px-4',
        xs: 'h-8 gap-1 px-3 text-xs has-[>svg]:px-2.5 [&_svg:not([class*="size-"])]:size-3',
        sm: 'h-9 gap-1.5 px-4 text-[13px] has-[>svg]:px-3.5',
        lg: 'h-12 px-7 text-[14px] has-[>svg]:px-6',
        xl: 'h-14 px-8 text-[15px] has-[>svg]:px-7',
        icon: 'size-11 rounded-full p-0',
        'icon-xs': 'size-8 rounded-full p-0 [&_svg:not([class*="size-"])]:size-3',
        'icon-sm': 'size-9 rounded-full p-0',
        'icon-lg': 'size-12 rounded-full p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
