'use client'

/**
 * Team-members admin CRUD client.
 *
 * Lists members, lets the admin add/edit/delete, reorder via sort_order,
 * toggle active, and upload a photo (multipart → /api/admin/media,
 * returns a public URL we store in photoUrl).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirm, alert } from '@/components/ui/dialog-imperative'

interface Member {
  id: string
  name: string
  role: string
  bio: string | null
  photoUrl: string | null
  linkedinUrl: string | null
  sortOrder: number
  active: boolean
}

const BLANK: Omit<Member, 'id'> = {
  name: '', role: '', bio: '', photoUrl: '', linkedinUrl: '', sortOrder: 0, active: true,
}

export function TeamMembersClient({ initial }: { initial: Member[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState<Omit<Member, 'id'>>(BLANK)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  const startAdd = () => { setEditing(null); setForm(BLANK) }
  const startEdit = (m: Member) => { setEditing(m); setForm({ ...m, bio: m.bio ?? '', photoUrl: m.photoUrl ?? '', linkedinUrl: m.linkedinUrl ?? '' }) }

  const save = async () => {
    if (!form.name.trim() || !form.role.trim()) { await alert({ title: 'Name and role are required' }); return }
    setBusy(true)
    try {
      const url = editing ? `/api/admin/team-members?id=${editing.id}` : '/api/admin/team-members'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      setForm(BLANK); setEditing(null)
      router.refresh()
    } catch (e) {
      await alert({ title: 'Save failed', description: String((e as Error).message) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: Member) => {
    if (!(await confirm({ title: `Remove ${m.name}?`, variant: 'destructive', confirmText: 'Remove' }))) return
    await fetch(`/api/admin/team-members?id=${m.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const uploadPhoto = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('alt', form.name || 'Team member')
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setForm((f) => ({ ...f, photoUrl: data.url }))
    } catch (e) {
      await alert({ title: 'Upload failed', description: String((e as Error).message) })
    } finally {
      setUploading(false)
    }
  }

  const input = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--color-accent)]'
  const label = 'text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-muted)] mb-1.5 block'

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-medium">Members ({initial.length})</h2>
          <button onClick={startAdd} className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-medium text-white">+ Add</button>
        </div>
        {initial.length === 0 ? (
          <p className="text-[14px] text-[var(--color-fg-muted)]">No team members yet. Add the first one →</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {initial.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  {m.photoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-[13px] text-[var(--color-fg-subtle)]">{m.name[0]}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    {m.name}
                    {!m.active && <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">hidden</span>}
                  </div>
                  <div className="text-[12px] text-[var(--color-fg-muted)]">{m.role} · sort {m.sortOrder}</div>
                </div>
                <button onClick={() => startEdit(m)} className="text-[12px] text-[var(--color-accent)]">Edit</button>
                <button onClick={() => remove(m)} className="text-[12px] text-[var(--color-danger,red)]">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Form */}
      <div className="rounded-lg border border-[var(--color-border)] p-5 space-y-3 h-fit">
        <h3 className="font-display text-[16px] font-medium">{editing ? 'Edit member' : 'New member'}</h3>

        <div>
          <label className={label}>Photo</label>
          <div className="flex items-center gap-3">
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface)]">
              {form.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--color-fg-subtle)]">none</div>}
            </div>
            <label className="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[12px]">
              {uploading ? 'Uploading…' : 'Upload'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
            </label>
          </div>
        </div>

        <div><label className={label}>Name *</label><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className={label}>Role *</label><input className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
        <div><label className={label}>Bio</label><textarea className={input} rows={3} value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
        <div><label className={label}>LinkedIn URL</label><input className={input} value={form.linkedinUrl ?? ''} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Sort order</label><input type="number" className={input} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></div>
          <label className="flex items-end gap-2 pb-2 text-[13px]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Visible
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          {editing && <button onClick={startAdd} className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-[13px]">Cancel</button>}
          <button onClick={save} disabled={busy} className="flex-1 rounded-md bg-[var(--color-accent)] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-60">
            {busy ? 'Saving…' : editing ? 'Update' : 'Add member'}
          </button>
        </div>
      </div>
    </div>
  )
}
