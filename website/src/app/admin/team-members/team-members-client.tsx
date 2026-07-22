'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { alert, confirm } from '@/components/ui/dialog-imperative'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'

interface ApprovedPhoto {
  id: string
  url: string
  alt: string
  filename: string | null
}

interface Member {
  id: string
  name: string
  role: string
  bio: string | null
  mediaId: string | null
  photoUrl: string | null
  photoAlt: string | null
  linkedinUrl: string | null
  sortOrder: number
  active: boolean
}

interface MemberForm {
  name: string
  role: string
  bio: string
  mediaId: string | null
  linkedinUrl: string
  sortOrder: number
  active: boolean
}

const BLANK: MemberForm = {
  name: '', role: '', bio: '', mediaId: null, linkedinUrl: '', sortOrder: 0, active: true,
}

interface Props {
  initial: Member[]
  approvedMedia: ApprovedPhoto[]
  memberTotal: number
  memberPage: number
  memberPageSize: number
  memberQuery: string
  mediaTotal: number
  mediaPage: number
  mediaPageSize: number
  mediaQuery: string
}

export function TeamMembersClient({
  initial,
  approvedMedia,
  memberTotal,
  memberPage,
  memberPageSize,
  memberQuery,
  mediaTotal,
  mediaPage,
  mediaPageSize,
  mediaQuery,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Clear-filter href that keeps the other list's own search/page state.
  const clearHref = (drop: string[]) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const key of drop) next.delete(key)
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState<MemberForm>(BLANK)
  const [busy, setBusy] = useState(false)
  // Cache of the currently-selected photo so its preview survives even when
  // the picker is paged/searched away from the page that held it.
  const [pickedPhoto, setPickedPhoto] = useState<ApprovedPhoto | null>(null)

  const selectedMedia = form.mediaId
    ? approvedMedia.find((media) => media.id === form.mediaId)
      ?? (pickedPhoto && pickedPhoto.id === form.mediaId ? pickedPhoto : null)
    : null

  function startAdd() {
    setEditing(null)
    setForm(BLANK)
    setPickedPhoto(null)
  }

  function startEdit(member: Member) {
    setEditing(member)
    setForm({
      name: member.name,
      role: member.role,
      bio: member.bio ?? '',
      mediaId: member.mediaId,
      linkedinUrl: member.linkedinUrl ?? '',
      sortOrder: member.sortOrder,
      active: member.active,
    })
    // Seed the preview from the member's already-resolved photo so editing a
    // member whose photo isn't on the current picker page still shows it.
    setPickedPhoto(
      member.mediaId && member.photoUrl
        ? { id: member.mediaId, url: member.photoUrl, alt: member.photoAlt ?? '', filename: null }
        : null,
    )
  }

  function pickPhoto(media: ApprovedPhoto) {
    setForm((current) => ({ ...current, mediaId: media.id }))
    setPickedPhoto(media)
  }

  async function save() {
    if (!form.name.trim() || !form.role.trim()) {
      await alert({ title: 'Name and role are required' })
      return
    }
    setBusy(true)
    try {
      const url = editing ? `/api/admin/team-members?id=${editing.id}` : '/api/admin/team-members'
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Save failed')
      startAdd()
      router.refresh()
    } catch (error) {
      await alert({ title: 'Save failed', description: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  async function remove(member: Member) {
    if (!(await confirm({ title: `Remove ${member.name}?`, variant: 'destructive', confirmText: 'Remove' }))) return
    const response = await fetch(`/api/admin/team-members?id=${member.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      await alert({ title: 'Delete failed', description: data.error ?? 'The member could not be removed.' })
      return
    }
    router.refresh()
  }

  const input = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[14px] outline-none transition-colors focus:border-[var(--color-accent)]'
  const label = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-muted)]'

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-3" aria-labelledby="team-member-list-title">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Public roster</span>
            <h2 id="team-member-list-title" className="mt-1 font-display text-[18px] font-medium">{memberTotal} {memberQuery ? 'matching ' : ''}member{memberTotal === 1 ? '' : 's'}</h2>
          </div>
          <div className="flex w-full items-center gap-2 sm:max-w-sm">
            <AdminSearch
              placeholder="Search name, role or bio"
              label="Search team members"
              paramName="memberQ"
              pageParamName="memberPage"
            />
            <button type="button" onClick={startAdd} className="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-2 text-[12px] font-medium text-white transition-transform active:scale-[0.97]">Add member</button>
          </div>
        </div>

        {initial.length === 0 ? (
          memberQuery ? (
            <FilteredEmptyState
              query={memberQuery}
              clearHref={clearHref(['memberQ', 'memberPage'])}
              entityLabel="members"
            />
          ) : (
            <p className="text-[14px] text-[var(--color-fg-muted)]">No team members yet. Add the first member.</p>
          )
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {initial.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  {member.photoUrl ? (
                    // Admin previews are resolved server-side through the same approval gate.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photoUrl} alt={member.photoAlt ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[13px] text-[var(--color-fg-subtle)]">{member.name[0]}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    <span className="truncate">{member.name}</span>
                    {!member.active && <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">Hidden</span>}
                  </div>
                  <div className="truncate text-[12px] text-[var(--color-fg-muted)]">{member.role} · sort {member.sortOrder}</div>
                </div>
                <button type="button" onClick={() => startEdit(member)} className="text-[12px] text-[var(--color-accent)]">Edit</button>
                <button type="button" onClick={() => remove(member)} className="text-[12px] text-[var(--color-danger,red)]">Delete</button>
              </li>
            ))}
          </ul>
        )}

        <AdminPagination
          page={memberPage}
          pageSize={memberPageSize}
          total={memberTotal}
          pageParamName="memberPage"
          label="Team roster pages"
        />
      </section>

      <aside className="h-fit space-y-5 rounded-lg border border-[var(--color-border)] p-5" aria-labelledby="team-member-form-title">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Roster record</span>
          <h3 id="team-member-form-title" className="mt-1 font-display text-[16px] font-medium">{editing ? 'Edit member' : 'New member'}</h3>
        </div>

        <div>
          <span className={label}>Approved photo</span>
          <div className="mb-3 flex items-center gap-3">
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface)]">
              {selectedMedia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedMedia.url} alt={selectedMedia.alt} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">No photo</div>
              )}
            </div>
            <div className="min-w-0 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
              {selectedMedia ? <p className="line-clamp-3">{selectedMedia.alt}</p> : <p>Optional. Only approved licensed images can be selected.</p>}
              {form.mediaId ? <button type="button" onClick={() => { setForm((current) => ({ ...current, mediaId: null })); setPickedPhoto(null) }} className="mt-1 text-[var(--color-danger)]">Remove photo</button> : null}
            </div>
          </div>

          <AdminSearch
            placeholder="Search approved photos"
            label="Search approved photos"
            paramName="mediaQ"
            pageParamName="mediaPage"
          />
          {approvedMedia.length === 0 ? (
            mediaQuery ? (
              <div className="mt-3">
                <FilteredEmptyState
                  query={mediaQuery}
                  clearHref={clearHref(['mediaQ', 'mediaPage'])}
                  entityLabel="approved photos"
                />
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-[var(--color-border)] p-3 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
                <p>No approved image is available.</p>
                <Link href="/admin/media" className="mt-1 inline-block text-[var(--color-accent)] underline underline-offset-4">Open licensed media</Link>
              </div>
            )
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {approvedMedia.map((media) => {
                const selected = media.id === form.mediaId
                return (
                  <li key={media.id}>
                    <button
                      type="button"
                      onClick={() => pickPhoto(media)}
                      aria-pressed={selected}
                      className={`group w-full overflow-hidden rounded-md border bg-[var(--color-surface)] text-left transition-colors ${selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
                    >
                      <span className="block aspect-square overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={media.url} alt="" className="h-full w-full object-cover" />
                      </span>
                      <span className="block truncate px-1.5 py-1 font-mono text-[9px] text-[var(--color-fg-muted)]">{media.filename ?? media.alt}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <AdminPagination
            page={mediaPage}
            pageSize={mediaPageSize}
            total={mediaTotal}
            pageParamName="mediaPage"
            label="Approved photo pages"
          />
        </div>

        <div><label className={label}>Name *</label><input className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
        <div><label className={label}>Role *</label><input className={input} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></div>
        <div><label className={label}>Bio</label><textarea className={input} rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></div>
        <div><label className={label}>LinkedIn URL</label><input className={input} value={form.linkedinUrl} onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Sort order</label><input type="number" className={input} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })} /></div>
          <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Visible</label>
        </div>

        <div className="flex gap-2 pt-2">
          {editing && <button type="button" onClick={startAdd} className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-[13px] transition-transform active:scale-[0.97]">Cancel</button>}
          <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-md bg-[var(--color-accent)] px-3 py-2 text-[13px] font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-60">
            {busy ? 'Saving…' : editing ? 'Update member' : 'Add member'}
          </button>
        </div>
      </aside>
    </div>
  )
}
