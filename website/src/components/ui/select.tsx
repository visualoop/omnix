'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CaretDown, Check } from '@phosphor-icons/react'

import { cn } from '@/lib/cn'

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
      data-slot="select-trigger"
      className={cn(
        'inline-flex h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5',
        'font-sans text-[14px] text-[var(--color-fg)] outline-none',
        'transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-55',
        'data-[placeholder]:text-[var(--color-fg-subtle)] aria-invalid:border-[var(--color-negative)]',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDown className="size-4 shrink-0 text-[var(--color-fg-muted)] transition-transform duration-[var(--duration-fast)] data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          'z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'origin-[var(--radix-select-content-transform-origin)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] shadow-[0_18px_48px_rgba(23,23,19,0.14)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-[var(--duration-ui)] ease-[var(--ease-out)] motion-reduce:animate-none',
          className,
        )}
        position={position}
        sideOffset={sideOffset}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
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
      data-slot="select-item"
      className={cn(
        'relative flex min-h-9 w-full cursor-default select-none items-center rounded-[var(--radius-sm)] py-2 pl-8 pr-3 text-[13px] outline-none',
        'focus:bg-[var(--color-surface)] focus:text-[var(--color-fg)]',
        'data-[state=checked]:bg-[var(--color-accent-soft)] data-[state=checked]:font-medium data-[state=checked]:text-[var(--color-accent)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5" weight="bold" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--color-border)]', className)}
      {...props}
    />
  )
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        'px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]',
        className,
      )}
      {...props}
    />
  )
}
