'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CaretDown, Check } from '@phosphor-icons/react'

/**
 * Editorial Select primitive — Radix Select wrapped to match the
 * espresso-paper admin aesthetic. Use this everywhere a native
 * <select> would otherwise go.
 *
 *   <Select value={role} onValueChange={setRole}>
 *     <SelectTrigger><SelectValue placeholder="Pick a role" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="owner">Owner</SelectItem>
 *       <SelectItem value="admin">Admin</SelectItem>
 *     </SelectContent>
 *   </Select>
 */
function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-fg)]',
        'transition-colors hover:border-[var(--color-border-strong)]',
        'focus:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[placeholder]:text-[var(--color-fg-muted)]',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDown className="size-3.5 text-[var(--color-fg-muted)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-7 pr-2 text-[13px] outline-none',
        'focus:bg-[var(--color-bg-muted)] focus:text-[var(--color-fg)]',
        'data-[state=checked]:bg-[var(--color-accent-soft)] data-[state=checked]:text-[var(--color-accent)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export function SelectSeparator(
  props: React.ComponentProps<typeof SelectPrimitive.Separator>,
) {
  return <SelectPrimitive.Separator className="my-1 h-px bg-[var(--color-border)]" {...props} />
}

export function SelectLabel(
  props: React.ComponentProps<typeof SelectPrimitive.Label>,
) {
  return (
    <SelectPrimitive.Label
      className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]"
      {...props}
    />
  )
}
