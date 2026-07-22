'use client'

/**
 * Imperative dialog helpers — Radix Dialog-based replacements for
 * native window.confirm / window.alert / window.prompt.
 *
 * Zero external state deps — plain module-level subscriber list +
 * useSyncExternalStore on the host component. Keeps the marketing
 * site bundle lean (no zustand needed on the website).
 *
 * Usage:
 *   const ok = await confirm({ title: "Delete this?", variant: "destructive" })
 *   if (!ok) return
 *
 *   await alert({ title: "Saved", description: "…" })
 *
 *   const name = await prompt({ title: "New name", required: true })
 *   if (!name) return
 *
 * Mount once at app root (or in the root layout):
 *   <DialogHost />
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
}
interface AlertOptions {
  title: string
  description?: string
  buttonText?: string
}
interface PromptOptions {
  title: string
  description?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  required?: boolean
}

type DialogState =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }

// ─── Minimal external store ───────────────────────────────────────
// Module-scoped state + subscribers list. React reads through
// useSyncExternalStore on the host component. Zero extra deps.

let currentDialog: DialogState | null = null
const listeners = new Set<() => void>()

function setCurrentDialog(next: DialogState | null): void {
  currentDialog = next
  listeners.forEach((l) => l())
}

function getSnapshot(): DialogState | null {
  return currentDialog
}

function getServerSnapshot(): DialogState | null {
  // SSR: nothing to render. Prevents hydration mismatch.
  return null
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

// ─── Imperative API ────────────────────────────────────────────────

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    setCurrentDialog({ kind: 'confirm', opts, resolve })
  })
}

export function alert(opts: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    setCurrentDialog({ kind: 'alert', opts, resolve })
  })
}

export function prompt(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    setCurrentDialog({ kind: 'prompt', opts, resolve })
  })
}

// ─── The Host ─────────────────────────────────────────────────────

export function DialogHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [promptValue, setPromptValue] = useState('')

  useEffect(() => {
    if (current?.kind === 'prompt') {
      setPromptValue(current.opts.defaultValue ?? '')
    }
  }, [current])

  if (!current) return null

  const handleConfirm = (): void => {
    if (current.kind === 'confirm') current.resolve(true)
    else if (current.kind === 'alert') current.resolve()
    else if (current.kind === 'prompt') {
      const val = promptValue.trim()
      if (current.opts.required && !val) return
      current.resolve(val || null)
    }
    setCurrentDialog(null)
  }

  const handleCancel = (): void => {
    if (current.kind === 'confirm') current.resolve(false)
    else if (current.kind === 'prompt') current.resolve(null)
    else current.resolve()
    setCurrentDialog(null)
  }

  const isDestructive = current.kind === 'confirm' && current.opts.variant === 'destructive'
  const isWarning = current.kind === 'confirm' && current.opts.variant === 'warning'

  const confirmLabel =
    current.kind === 'confirm' ? (current.opts.confirmText ?? (isDestructive ? 'Delete' : 'OK')) :
    current.kind === 'alert' ? (current.opts.buttonText ?? 'OK') :
    (current.opts.confirmText ?? 'OK')

  const cancelLabel =
    current.kind === 'confirm' ? (current.opts.cancelText ?? 'Cancel') :
    current.kind === 'prompt' ? (current.opts.cancelText ?? 'Cancel') :
    ''

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) handleCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[81] w-[90vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && current.kind !== 'prompt') {
              e.preventDefault()
              handleConfirm()
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-[15px] font-semibold text-[var(--color-fg)]">
              {current.opts.title}
            </Dialog.Title>
            <Dialog.Close
              onClick={handleCancel}
              className="rounded-md p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {current.opts.description ? (
            <Dialog.Description className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
              {current.opts.description}
            </Dialog.Description>
          ) : null}

          {current.kind === 'prompt' ? (
            <Input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={current.opts.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
              className="mt-4"
            />
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            {current.kind !== 'alert' ? (
              <Button variant="ghost" size="sm" onClick={handleCancel} className="text-[13px]">
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              variant={isDestructive ? 'destructive' : 'default'}
              size="sm"
              onClick={handleConfirm}
              className={cn(
                'text-[13px]',
                isWarning && 'bg-amber-500 text-amber-950 hover:bg-amber-500/90',
              )}
              disabled={current.kind === 'prompt' && current.opts.required === true && !promptValue.trim()}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
