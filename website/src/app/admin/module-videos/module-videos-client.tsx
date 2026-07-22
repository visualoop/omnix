'use client'

/*
 * Admin management UI for module demo videos.
 *
 * Five fixed cards — one per product enum entry. Because the set is a fixed
 * five-row enum (not an unbounded list), there is deliberately no search or pagination
 * here: the whole set is always visible and editable. Each card takes a
 * YouTube URL, a title, and a text summary, with publish / unpublish and
 * clear actions and a preview link. No secrets are shown or collected.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import type { ModuleDemoProduct } from '@/lib/youtube-demo'
import { parseYouTubeUrl } from '@/lib/youtube-demo'

export interface ModuleVideoRow {
  product: ModuleDemoProduct
  label: string
  videoId: string
  title: string
  summary: string
  published: boolean
  updatedAt: string | null
}

interface CardState {
  url: string
  title: string
  summary: string
  published: boolean
  busy: boolean
  error: string | null
  notice: string | null
}

function watchUrlFor(videoId: string): string {
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''
}

export function ModuleVideosClient({ initial }: { initial: ModuleVideoRow[] }) {
  const router = useRouter()
  const [cards, setCards] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(
      initial.map((row) => [
        row.product,
        {
          url: watchUrlFor(row.videoId),
          title: row.title,
          summary: row.summary,
          published: row.published,
          busy: false,
          error: null,
          notice: null,
        },
      ]),
    ),
  )

  function update(product: string, patch: Partial<CardState>) {
    setCards((current) => ({ ...current, [product]: { ...current[product], ...patch } }))
  }

  async function save(product: ModuleDemoProduct, published: boolean) {
    const card = cards[product]
    update(product, { busy: true, error: null, notice: null })
    try {
      const response = await fetch('/api/admin/module-videos', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product,
          url: card.url.trim(),
          title: card.title.trim(),
          summary: card.summary.trim(),
          published,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; action?: string }
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Save failed')
      update(product, { published, notice: `Saved (${data.action ?? 'updated'}).` })
      router.refresh()
    } catch (error) {
      update(product, { error: error instanceof Error ? error.message : String(error) })
    } finally {
      update(product, { busy: false })
    }
  }

  async function clear(product: ModuleDemoProduct) {
    update(product, { busy: true, error: null, notice: null })
    try {
      const response = await fetch('/api/admin/module-videos', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product, url: '', title: '', summary: '', published: false }),
      })
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Clear failed')
      update(product, { url: '', title: '', summary: '', published: false, notice: 'Cleared and unpublished.' })
      router.refresh()
    } catch (error) {
      update(product, { error: error instanceof Error ? error.message : String(error) })
    } finally {
      update(product, { busy: false })
    }
  }

  // Unpublish is a consequential, product-scoped removal — it takes the demo
  // off the public /{product} page immediately. Require an explicit,
  // imperative confirmation with a cancel path before it runs. The per-card
  // `busy` lock (below) already prevents a double submit.
  async function confirmUnpublish(product: ModuleDemoProduct, label: string) {
    if (cards[product]?.busy) return
    const ok = await confirm({
      title: `Unpublish the ${label} demo video?`,
      description:
        `This immediately removes the demo from the public /${product} product page — visitors will no longer see it. The saved link, title, and summary stay as a draft, so you can republish later.`,
      variant: 'warning',
      confirmText: 'Unpublish',
      cancelText: 'Keep published',
    })
    if (!ok) return
    await save(product, false)
  }

  // Clear wipes the saved link, title, and summary AND unpublishes — an
  // irreversible, product-scoped destructive action. Confirm before running.
  async function confirmClear(product: ModuleDemoProduct, label: string) {
    if (cards[product]?.busy) return
    const ok = await confirm({
      title: `Clear the ${label} demo video?`,
      description:
        `This removes the demo from the public /${product} product page and erases the saved link, title, and summary. This cannot be undone — you would have to paste the details again.`,
      variant: 'destructive',
      confirmText: 'Clear video',
      cancelText: 'Cancel',
    })
    if (!ok) return
    await clear(product)
  }

  const input =
    'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[14px] outline-none transition-colors focus:border-[var(--color-accent)]'
  const label = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-muted)]'

  return (
    <div className="grid gap-5">
      {initial.map((row) => {
        const card = cards[row.product]
        const parsed = card.url.trim() ? parseYouTubeUrl(card.url.trim()) : null
        const previewId = parsed?.ok ? parsed.videoId : row.videoId
        const canPublish =
          Boolean(parsed?.ok) && card.title.trim().length > 0 && card.summary.trim().length > 0

        return (
          <section
            key={row.product}
            data-module-video-card={row.product}
            aria-labelledby={`module-video-${row.product}`}
            className="rounded-lg border border-[var(--color-border)] p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                  /{row.product}
                </span>
                <h2 id={`module-video-${row.product}`} className="mt-0.5 font-display text-[18px] font-medium">
                  {row.label}
                </h2>
              </div>
              <span
                className={`rounded-[var(--radius-xs)] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  card.published
                    ? 'border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-fg-muted)]'
                }`}
              >
                {card.published ? 'Published' : 'Unpublished'}
              </span>
            </div>

            <div className="grid gap-4">
              <div>
                <label className={label} htmlFor={`url-${row.product}`}>
                  YouTube link (watch, youtu.be, shorts, or nocookie embed)
                </label>
                <input
                  id={`url-${row.product}`}
                  className={input}
                  value={card.url}
                  placeholder="https://www.youtube.com/watch?v=…"
                  onChange={(event) => update(row.product, { url: event.target.value })}
                />
                {card.url.trim() && parsed && !parsed.ok ? (
                  <p className="mt-1 text-[12px] text-[var(--color-negative)]">{parsed.error}</p>
                ) : null}
              </div>

              <div>
                <label className={label} htmlFor={`title-${row.product}`}>
                  Accessible title
                </label>
                <input
                  id={`title-${row.product}`}
                  className={input}
                  value={card.title}
                  onChange={(event) => update(row.product, { title: event.target.value })}
                />
              </div>

              <div>
                <label className={label} htmlFor={`summary-${row.product}`}>
                  Text summary / transcript fallback (required)
                </label>
                <textarea
                  id={`summary-${row.product}`}
                  className={input}
                  rows={3}
                  value={card.summary}
                  onChange={(event) => update(row.product, { summary: event.target.value })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={card.busy}
                  onClick={() => save(row.product, false)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-2 text-[13px] transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {card.busy ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  disabled={card.busy || !canPublish}
                  onClick={() => save(row.product, true)}
                  className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-[13px] font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-50"
                >
                  Publish
                </button>
                {card.published ? (
                  <button
                    type="button"
                    disabled={card.busy}
                    onClick={() => confirmUnpublish(row.product, row.label)}
                    className="rounded-md border border-[var(--color-border)] px-3 py-2 text-[13px] transition-transform active:scale-[0.97] disabled:opacity-60"
                  >
                    Unpublish
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={card.busy}
                  onClick={() => confirmClear(row.product, row.label)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-2 text-[13px] text-[var(--color-negative)] transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  Clear
                </button>
                {previewId ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${previewId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-[var(--color-accent)] underline underline-offset-4"
                  >
                    Preview on YouTube
                  </a>
                ) : null}
              </div>

              {card.error ? <p role="alert" className="text-[12px] text-[var(--color-negative)]">{card.error}</p> : null}
              {card.notice ? <p role="status" aria-live="polite" className="text-[12px] text-[var(--color-positive)]">{card.notice}</p> : null}
              {row.updatedAt ? (
                <p className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                  Last updated {new Date(row.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
