'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MediaItem {
  id: string
  url: string
  key: string
  slot: string | null
  alt: string | null
  filename: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
}

interface SlotBinding {
  slot: string
  label: string
  section: string
  aspect: string
  currentUrl: string | null
  currentAlt: string | null
}

/**
 * Admin media library — slot grid + recent uploads + drop-zone upload.
 *
 * Keeps the upload UX one-step: drop a file → it uploads → grid
 * refreshes. Per-row Slot dropdown reassigns the slot in-place via
 * PATCH. Delete asks first.
 */
export function MediaLibrary({
  initialItems,
  slotBindings,
}: {
  initialItems: MediaItem[]
  slotBindings: SlotBinding[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File, slot: string | null) {
    const fd = new FormData()
    fd.append('file', file)
    if (slot) fd.append('slot', slot)
    setBusy(slot ?? '__upload')
    try {
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        alert(data.error ?? 'Upload failed')
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusy(null)
    }
  }

  async function patchSlot(id: string, slot: string | null) {
    const res = await fetch(`/api/admin/media?id=${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slot }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!data.ok) {
      alert(data.error ?? 'Update failed')
      return
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, slot } : it)))
    startTransition(() => router.refresh())
  }

  async function patchAlt(id: string, alt: string) {
    const res = await fetch(`/api/admin/media?id=${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alt: alt || null }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!data.ok) {
      alert(data.error ?? 'Update failed')
      return
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, alt: alt || null } : it)))
  }

  async function remove(id: string) {
    if (!confirm('Delete this image? The file is removed from R2 and the URL stops working.')) return
    const res = await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!data.ok) {
      alert(data.error ?? 'Delete failed')
      return
    }
    setItems((prev) => prev.filter((it) => it.id !== id))
    startTransition(() => router.refresh())
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url).catch(() => {})
  }

  return (
    <div className="space-y-10">
      {/* Slot grid */}
      <section>
        <div className="mb-3 border-b border-[var(--color-border)] pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            Featured slots
          </span>
          <h2
            style={{ fontFamily: 'var(--font-display)' }}
            className="mt-1 text-[18px] font-medium tracking-[-0.01em]"
          >
            Where these go on the public site
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {slotBindings.map((b) => (
            <SlotCard
              key={b.slot}
              binding={b}
              busy={busy === b.slot}
              onUpload={(file) => upload(file, b.slot)}
            />
          ))}
        </div>
      </section>

      {/* Unslotted upload */}
      <section>
        <div className="mb-3 border-b border-[var(--color-border)] pb-2 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
              Library
            </span>
            <h2
              style={{ fontFamily: 'var(--font-display)' }}
              className="mt-1 text-[18px] font-medium tracking-[-0.01em]"
            >
              {items.length} uploaded image{items.length === 1 ? '' : 's'}
            </h2>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy === '__upload'}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-50 cursor-pointer"
          >
            {busy === '__upload' ? 'Uploading…' : 'Upload image'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f, null)
              e.target.value = ''
            }}
          />
        </div>

        {items.length === 0 ? (
          <p className="text-[13px] text-[var(--color-fg-muted)]">
            Nothing uploaded yet. Drop an image into any slot above or use the Upload button.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
              >
                <div className="aspect-[16/9] bg-[var(--color-bg-muted)] grid place-items-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.alt ?? ''} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium truncate min-w-0 flex-1">
                      {it.filename ?? it.key.split('/').pop()}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-fg-muted)] shrink-0">
                      {Math.round(it.sizeBytes / 1024)} KB
                    </span>
                  </div>
                  <Select value={it.slot ?? ''} onValueChange={(v) => patchSlot(it.id, String(v) || null)}><SelectTrigger><SelectValue placeholder="— unassigned —" /></SelectTrigger><SelectContent>
                    
                    {slotBindings.map((b) => (
                      <SelectItem key={b.slot} value={b.slot}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent></Select>
                  <input
                    type="text"
                    defaultValue={it.alt ?? ''}
                    placeholder="Alt text (for screen readers)"
                    onBlur={(e) => {
                      if (e.target.value !== (it.alt ?? '')) patchAlt(it.id, e.target.value)
                    }}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[12px]"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => copy(it.url)}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      Copy URL
                    </button>
                    <span className="text-[var(--color-fg-muted)]">·</span>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      Open
                    </a>
                    <span className="text-[var(--color-fg-muted)]">·</span>
                    <button
                      onClick={() => remove(it.id)}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700 hover:text-rose-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SlotCard({
  binding,
  busy,
  onUpload,
}: {
  binding: SlotBinding
  busy: boolean
  onUpload: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div
        className="bg-[var(--color-bg-muted)] grid place-items-center overflow-hidden"
        style={{ aspectRatio: binding.aspect.replace('/', ' / ') }}
      >
        {binding.currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={binding.currentUrl}
            alt={binding.currentAlt ?? ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            empty
          </span>
        )}
      </div>
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            {binding.section}
          </span>
          <span className="text-[12px] font-medium truncate">{binding.label}</span>
          <code className="font-mono text-[10px] text-[var(--color-fg-muted)] truncate">
            {binding.slot}
          </code>
        </div>
        <button
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Uploading…' : binding.currentUrl ? 'Replace' : 'Upload'}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
