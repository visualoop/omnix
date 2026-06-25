/**
 * /admin/media — image library.
 *
 * Three sections:
 *   1. Slot grid — every named slot (hero.background, module.*.hero, etc.)
 *      gets a card showing the current bound image with a "Replace" button.
 *      Empty slots show a dashed dropzone.
 *   2. Recent uploads — grid of every uploaded image with metadata, edit
 *      (slot/alt), copy URL, delete.
 *   3. Quick upload — drop zone at the top that uploads unslotted.
 *
 * Auth: platform_admin only. Layout enforces staff; this page narrows
 * to admin via the redirect at the top.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { desc } from 'drizzle-orm'
import { db, platformMedia } from '@/db'
import { auth } from '@/lib/auth'
import { MEDIA_SLOTS } from '@/lib/media-slots'
import { MediaLibrary } from '@/components/admin/media-library'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?next=/admin/media')
  if (session.user.role !== 'platform_admin') redirect('/admin')

  const items = await db
    .select()
    .from(platformMedia)
    .orderBy(desc(platformMedia.createdAt))
    .limit(500)

  // Bucket by slot for the slot-grid section.
  const bySlot = new Map<string, typeof items[number]>()
  for (const it of items) {
    if (it.slot && !bySlot.has(it.slot)) bySlot.set(it.slot, it)
  }
  const slotBindings = MEDIA_SLOTS.map((def) => ({
    ...def,
    current: bySlot.get(def.slot) ?? null,
  }))

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
          Marketing site
        </span>
        <h1
          style={{ fontFamily: 'var(--font-display)' }}
          className="mt-1 text-[28px] font-medium tracking-[-0.01em]"
        >
          Media library
        </h1>
        <p className="mt-1 text-[14px] text-[var(--color-fg-muted)] max-w-[60ch]">
          Featured images for every page section. Upload once; the slot
          pulls it onto the live site within seconds (server cache is
          invalidated on every upload).
        </p>
      </header>

      <MediaLibrary
        initialItems={items.map((it) => ({
          id: it.id,
          url: it.url,
          key: it.key,
          slot: it.slot,
          alt: it.alt,
          filename: it.filename,
          mimeType: it.mimeType,
          sizeBytes: it.sizeBytes,
          createdAt: it.createdAt.toISOString(),
        }))}
        slotBindings={slotBindings.map((s) => ({
          slot: s.slot,
          label: s.label,
          section: s.section,
          aspect: s.aspect,
          currentUrl: s.current?.url ?? null,
          currentAlt: s.current?.alt ?? null,
        }))}
      />
    </div>
  )
}
