'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  MEDIA_RIGHTS_BASES,
  MEDIA_RIGHTS_LABELS,
  type MediaApprovalState,
  type MediaRightsBasis,
} from '@/lib/media-governance'

interface MediaItem {
  id: string
  url: string
  previewUrl: string | null
  key: string
  slot: string | null
  alt: string
  filename: string | null
  mimeType: string
  sizeBytes: number
  rightsBasis: string
  rightsHolder: string
  rightsSource: string
  approvalState: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
}

interface MediaStorageStatus {
  publishReady: boolean
  reviewReady: boolean
  publicBucket: string
  quarantineBucket: string | null
  missingPublishingSettings: string[]
  reviewIssue: string | null
}

interface SlotBinding {
  slot: string
  label: string
  section: string
  aspect: string
  mediaType: 'image' | 'video'
  currentUrl: string | null
  currentAlt: string | null
}

const NO_SLOT = '__none__'

export function MediaLibrary({
  initialItems,
  storageStatus,
  slotBindings,
  page,
  pageSize,
  total,
  query,
}: {
  initialItems: MediaItem[]
  storageStatus: MediaStorageStatus
  slotBindings: SlotBinding[]
  page: number
  pageSize: number
  total: number
  query: string
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [busy, setBusy] = useState<string | null>(null)
  const [uploadSlot, setUploadSlot] = useState<string | null>(null)
  const [uploadMode, setUploadMode] = useState<'publish' | 'review'>('publish')
  const [uploadBasis, setUploadBasis] = useState<MediaRightsBasis>('owned')
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploadHolder, setUploadHolder] = useState('Omnix')
  const [uploadSource, setUploadSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // The server hands us exactly the current page (searched + bounded); keep
  // the local mirror in sync so optimistic edits reconcile after refresh().
  useEffect(() => setItems(initialItems), [initialItems])

  function prepareSlot(slot: string) {
    setUploadSlot(slot)
    document.getElementById('licensed-media-upload')?.scrollIntoView({ block: 'start' })
    fileRef.current?.focus()
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose an image or video before uploading.')
      return
    }
    if (!storageStatus.publishReady) {
      setError(`Publishing is not ready. Add ${storageStatus.missingPublishingSettings.join(', ')} in Storage & media settings.`)
      return
    }
    if (uploadMode === 'review' && !storageStatus.reviewReady) {
      setError('Private review is not configured. Choose Publish now or configure a separate private review bucket.')
      return
    }

    const form = new FormData()
    form.append('file', file)
    form.append('mode', uploadMode)
    if (uploadSlot) form.append('slot', uploadSlot)
    if (uploadAlt.trim()) form.append('alt', uploadAlt.trim())
    form.append('rightsBasis', uploadBasis)
    if (uploadHolder.trim()) form.append('rightsHolder', uploadHolder.trim())
    if (uploadSource.trim()) form.append('rightsSource', uploadSource.trim())

    setError(null)
    setBusy('__upload')
    try {
      const response = await fetch('/api/admin/media', { method: 'POST', body: form })
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? `Upload failed (${response.status})`)
        return
      }
      setUploadAlt('')
      setUploadHolder('Omnix')
      setUploadSource('')
      if (fileRef.current) fileRef.current.value = ''
      startTransition(() => router.refresh())
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Check the connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  function updateItem(id: string, patch: Partial<MediaItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function persist(item: MediaItem, approvalState?: MediaApprovalState) {
    setError(null)
    setBusy(item.id)
    try {
      const response = await fetch(`/api/admin/media?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slot: item.slot,
          alt: item.alt,
          rightsBasis: item.rightsBasis,
          rightsHolder: item.rightsHolder,
          rightsSource: item.rightsSource,
          ...(approvalState ? { approvalState } : {}),
        }),
      })
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; approvalState?: MediaApprovalState } | null
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? `Update failed (${response.status})`)
        return
      }
      updateItem(item.id, { approvalState: data.approvalState ?? 'pending' })
      startTransition(() => router.refresh())
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Update failed. Check the connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(item: MediaItem) {
    if (!(await confirm({
      title: 'Remove this media from public use?',
      description:
        'The public object is deleted from the CDN immediately and any slot it fills goes blank on the live site. Its rights and provenance record is kept as an audited tombstone — not erased — so the licence trail survives. This cannot be undone.',
      variant: 'destructive',
      confirmText: 'Remove from public',
    }))) return

    setError(null)
    setBusy(item.id)
    try {
      const response = await fetch(`/api/admin/media?id=${item.id}`, { method: 'DELETE' })
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; approvalState?: MediaApprovalState } | null
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? `Delete failed (${response.status})`)
        return
      }
      // Tombstone, not a hard erase: the row (and its provenance) is kept, so
      // reflect the removed/rejected state instead of dropping it from view.
      // router.refresh() reconciles with the server's authoritative row.
      updateItem(item.id, { approvalState: data.approvalState ?? 'rejected' })
      startTransition(() => router.refresh())
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed. Check the connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  function copyPublicUrl(item: MediaItem) {
    if (item.approvalState !== 'approved') return
    navigator.clipboard.writeText(item.url).catch(() => undefined)
  }

  return (
    <div className="space-y-10">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/5 px-4 py-3 text-[13px] text-[var(--color-negative)]"
        >
          {error}
        </p>
      ) : null}
      <section id="licensed-media-upload" className="scroll-mt-6 border-b border-[var(--color-border)] pb-10">
        <div className="mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">New asset</span>
          <h2 style={{ fontFamily: 'var(--font-display)' }} className="mt-1 text-[20px] font-medium">Upload and publish</h2>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            Choose a file and, if needed, where it appears. Omnix-owned rights details are recorded automatically; open the optional section only for third-party media.
          </p>
        </div>

        <div className="mb-5 flex flex-col gap-2 border-y border-[var(--color-border)] py-3 text-[12px] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className={storageStatus.publishReady ? 'font-medium text-[var(--color-positive)]' : 'font-medium text-[var(--color-negative)]'}>
              {storageStatus.publishReady ? `Public publishing ready · ${storageStatus.publicBucket}` : 'Public publishing needs configuration'}
            </span>
            <span className="mt-1 block text-[var(--color-fg-muted)]">
              {storageStatus.reviewReady
                ? `Private review ready · ${storageStatus.quarantineBucket}`
                : storageStatus.reviewIssue ?? 'Private review is optional.'}
            </span>
          </div>
          <Link
            href="/admin/settings#settings-storage"
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Open storage settings →
          </Link>
        </div>

        <form onSubmit={upload} className="grid grid-cols-1 gap-5 border-b border-[var(--color-border)] pb-5 lg:grid-cols-2">
          <Field label="Media file" hint="JPEG, PNG, WebP, AVIF, MP4 or WebM · maximum 50 MB">
            <input ref={fileRef} required type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="block w-full text-[13px] file:mr-3 file:rounded-md file:border file:border-[var(--color-border)] file:bg-[var(--color-bg)] file:px-3 file:py-2 file:text-[12px]" />
          </Field>
          <Field label="Public slot" hint="Optional. Leave unassigned to keep it in the reusable library.">
            <Select value={uploadSlot ?? NO_SLOT} onValueChange={(value) => setUploadSlot(value === NO_SLOT ? null : String(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SLOT}>Unassigned library asset</SelectItem>
                {slotBindings.map((slot) => <SelectItem key={slot.slot} value={slot.slot}>{slot.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Publish mode" hint="Private review is optional and needs a separate private bucket.">
            <Select value={uploadMode} onValueChange={(value) => setUploadMode(value as 'publish' | 'review')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="publish">Publish now</SelectItem>
                <SelectItem value="review" disabled={!storageStatus.reviewReady}>Send to private review</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <details className="lg:col-span-2 border-t border-[var(--color-border)] pt-4">
            <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
              Rights and accessibility details <span className="font-normal text-[var(--color-fg-muted)]">· optional for Omnix-owned files</span>
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Field label="Alt text" hint="Defaults to a readable version of the filename.">
                <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} placeholder="Describe useful visual content" className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]" />
              </Field>
              <Field label="Rights basis" hint="Owned by Omnix is the default.">
                <Select value={uploadBasis} onValueChange={(value) => setUploadBasis(value as MediaRightsBasis)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIA_RIGHTS_BASES.map((basis) => <SelectItem key={basis} value={basis}>{MEDIA_RIGHTS_LABELS[basis]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Rights holder" hint="Defaults to Omnix.">
                <input value={uploadHolder} onChange={(event) => setUploadHolder(event.target.value)} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]" />
              </Field>
              <Field label="Licence, permission, or source" hint="Optional for owned media; required context for third-party files.">
                <input value={uploadSource} onChange={(event) => setUploadSource(event.target.value)} placeholder="Contract, source URL, or internal note" className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]" />
              </Field>
            </div>
          </details>

          <div className="lg:col-span-2 flex justify-end">
            <button
              disabled={busy === '__upload' || !storageStatus.publishReady || (uploadMode === 'review' && !storageStatus.reviewReady)}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
            >
              {busy === '__upload' ? 'Uploading…' : uploadMode === 'review' ? 'Upload for review' : 'Upload and publish'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4 border-b border-[var(--color-border)] pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Public placements</span>
          <h2 style={{ fontFamily: 'var(--font-display)' }} className="mt-1 text-[18px] font-medium">Approved slot coverage</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {slotBindings.map((binding) => <SlotCard key={binding.slot} binding={binding} onPrepare={() => prepareSlot(binding.slot)} />)}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 border-b border-[var(--color-border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Rights register</span>
            <h2 style={{ fontFamily: 'var(--font-display)' }} className="mt-1 text-[18px] font-medium">{total.toLocaleString()} {query ? 'matching ' : ''}asset{total === 1 ? '' : 's'}</h2>
          </div>
          <AdminSearch
            placeholder="Search file, slot, holder, source or status"
            label="Search media rights register"
          />
        </div>

        {items.length === 0 ? (
          query ? (
            <FilteredEmptyState query={query} clearHref="/admin/media" entityLabel="media" />
          ) : (
            <p className="text-[13px] text-[var(--color-fg-muted)]">
              No media in the register yet. Upload a licensed asset above to begin.
            </p>
          )
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <MediaReviewCard
                key={item.id}
                item={item}
                slotBindings={slotBindings}
                busy={busy === item.id}
                onChange={(patch) => updateItem(item.id, patch)}
                onSave={() => persist(item)}
                onApprove={() => persist(item, 'approved')}
                onReject={() => persist(item, 'rejected')}
                onDelete={() => remove(item)}
                onCopy={() => copyPublicUrl(item)}
              />
            ))}
          </ul>
        )}

        <AdminPagination page={page} pageSize={pageSize} total={total} label="Rights register pages" />
      </section>
    </div>
  )
}

function MediaReviewCard({
  item, slotBindings, busy, onChange, onSave, onApprove, onReject, onDelete, onCopy,
}: {
  item: MediaItem
  slotBindings: SlotBinding[]
  busy: boolean
  onChange: (patch: Partial<MediaItem>) => void
  onSave: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onCopy: () => void
}) {
  const status = item.approvalState === 'approved' || item.approvalState === 'rejected' ? item.approvalState : 'pending'
  return (
    <li className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="grid grid-cols-[9rem_1fr] border-b border-[var(--color-border)]">
        <div className="aspect-square overflow-hidden bg-[var(--color-bg-muted)]">
          {item.previewUrl ? item.mimeType.startsWith('video/') ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={item.previewUrl} muted controls preload="metadata" className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center px-3 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">Preview unavailable</span>
          )}
        </div>
        <div className="min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{item.filename ?? item.key.split('/').pop()}</p>
              <p className="mt-1 font-mono text-[10px] text-[var(--color-fg-muted)]">{Math.round(item.sizeBytes / 1024)} KB · {item.mimeType}</p>
            </div>
            <Status state={status} />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
            {status === 'approved' ? 'Eligible for public slot resolution.' : status === 'rejected' ? 'Not eligible for public use.' : 'Private to admin review; not publicly resolved.'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <Field label="Slot"><Select value={item.slot ?? NO_SLOT} onValueChange={(value) => onChange({ slot: value === NO_SLOT ? null : String(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_SLOT}>Unassigned</SelectItem>{slotBindings.map((slot) => <SelectItem key={slot.slot} value={slot.slot}>{slot.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Rights basis"><Select value={MEDIA_RIGHTS_BASES.includes(item.rightsBasis as MediaRightsBasis) ? item.rightsBasis : 'unverified'} onValueChange={(value) => onChange({ rightsBasis: String(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{!MEDIA_RIGHTS_BASES.includes(item.rightsBasis as MediaRightsBasis) ? <SelectItem value="unverified" disabled>Unverified legacy record</SelectItem> : null}{MEDIA_RIGHTS_BASES.map((basis) => <SelectItem key={basis} value={basis}>{MEDIA_RIGHTS_LABELS[basis]}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Alt text"><input value={item.alt} onChange={(event) => onChange({ alt: event.target.value })} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]" /></Field>
        <Field label="Rights holder"><input value={item.rightsHolder} onChange={(event) => onChange({ rightsHolder: event.target.value })} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]" /></Field>
        <div className="sm:col-span-2"><Field label="Licence / permission / source reference"><input value={item.rightsSource} onChange={(event) => onChange({ rightsSource: event.target.value })} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]" /></Field></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
        <button type="button" disabled={busy} onClick={onSave} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-transform active:scale-[0.97] disabled:opacity-40">Save metadata</button>
        <button type="button" disabled={busy} onClick={onApprove} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-transform active:scale-[0.97] disabled:opacity-40 border-[var(--color-accent)] text-[var(--color-accent)]">Approve</button>
        <button type="button" disabled={busy} onClick={onReject} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-transform active:scale-[0.97] disabled:opacity-40">Reject</button>
        {status === 'approved' ? <button type="button" onClick={onCopy} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">Copy public URL</button> : null}
        {item.previewUrl ? <a href={item.previewUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">Preview source</a> : null}
        <button type="button" disabled={busy} onClick={onDelete} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] ml-auto text-[var(--color-danger)]">Delete</button>
      </div>
    </li>
  )
}

function SlotCard({ binding, onPrepare }: { binding: SlotBinding; onPrepare: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="grid place-items-center overflow-hidden bg-[var(--color-bg-muted)]" style={{ aspectRatio: binding.aspect.replace('/', ' / ') }}>
        {binding.currentUrl ? binding.mediaType === 'video' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={binding.currentUrl} muted controls preload="metadata" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={binding.currentUrl} alt={binding.currentAlt ?? ''} className="h-full w-full object-cover" />
        ) : <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">No approved asset</span>}
      </div>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">{binding.section}</span>
          <p className="truncate text-[12px] font-medium">{binding.label}</p>
          <code className="block truncate font-mono text-[10px] text-[var(--color-fg-muted)]">{binding.slot}</code>
        </div>
        <button type="button" onClick={onPrepare} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-transform active:scale-[0.97] disabled:opacity-40 shrink-0">Prepare upload</button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-medium">{label}</span>{children}{hint ? <span className="mt-1.5 block text-[11px] leading-relaxed text-[var(--color-fg-muted)]">{hint}</span> : null}</label>
}

function Status({ state }: { state: MediaApprovalState }) {
  const tone = state === 'approved'
    ? 'text-[var(--color-positive)] border-[var(--color-positive)]/30'
    : state === 'rejected'
      ? 'text-[var(--color-negative)] border-[var(--color-negative)]/30'
      : 'text-[var(--color-caution)] border-[var(--color-caution)]/30'
  return <span className={`rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${tone}`}>{state}</span>
}
