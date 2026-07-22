import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { count, desc, ilike, or } from 'drizzle-orm'
import { db, platformMedia } from '@/db'
import { auth } from '@/lib/auth'
import { getQuarantinePreviewUrl } from '@/lib/r2-media'
import { MEDIA_SLOTS, getSlotMedia } from '@/lib/media-slots'
import { MediaLibrary } from '@/components/admin/media-library'

export const dynamic = 'force-dynamic'

// Bounded page for the growing rights register. The fixed slot-coverage grid
// below is a closed enumeration (MEDIA_SLOTS) and is exempt from pagination.
const PAGE_SIZE = 12

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?next=/admin/media')
  if (session.user.role !== 'platform_admin') redirect('/admin')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  const where = q
    ? or(
        ilike(platformMedia.filename, `%${q}%`),
        ilike(platformMedia.key, `%${q}%`),
        ilike(platformMedia.slot, `%${q}%`),
        ilike(platformMedia.alt, `%${q}%`),
        ilike(platformMedia.rightsHolder, `%${q}%`),
        ilike(platformMedia.rightsSource, `%${q}%`),
        ilike(platformMedia.rightsBasis, `%${q}%`),
        ilike(platformMedia.approvalState, `%${q}%`),
        ilike(platformMedia.objectState, `%${q}%`),
      )
    : undefined

  // Register page (bounded) + stable total + fixed slot-coverage grid.
  // Slot coverage is resolved through the same publication gate the public
  // site uses (getSlotMedia), so this never needs to load the whole table.
  const [items, totalRow, slotMedia] = await Promise.all([
    db
      .select()
      .from(platformMedia)
      .where(where)
      .orderBy(desc(platformMedia.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(platformMedia).where(where),
    Promise.all(MEDIA_SLOTS.map((slot) => getSlotMedia(slot.slot))),
  ])

  const total = totalRow[0]?.n ?? 0

  const approvedBySlot = new Map<string, { url: string; alt: string }>()
  MEDIA_SLOTS.forEach((slot, i) => {
    const current = slotMedia[i]
    if (current) approvedBySlot.set(slot.slot, { url: current.url, alt: current.alt })
  })

  const initialItems = await Promise.all(items.map(async (item) => {
    const previewUrl = item.objectState === 'published' && item.url
      ? item.url
      : item.objectState === 'quarantine' && item.quarantineKey
        ? await getQuarantinePreviewUrl(item.quarantineKey).catch(() => null)
        : null
    return {
      id: item.id,
      url: item.url,
      previewUrl,
      key: item.key,
      slot: item.slot,
      alt: item.alt,
      filename: item.filename,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      rightsBasis: item.rightsBasis,
      rightsHolder: item.rightsHolder,
      rightsSource: item.rightsSource,
      approvalState: item.approvalState,
      approvedBy: item.approvedBy,
      approvedAt: item.approvedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    }
  }))

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
          Marketing site · rights register
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="mt-1 text-[28px] font-medium tracking-[-0.01em]">
          Licensed media
        </h1>
        <p className="mt-1 max-w-[68ch] text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
          Every asset needs alt text, a rights basis, a rights holder and a source record. Uploads remain private to this admin workflow until a platform admin approves them.
        </p>
      </header>

      <MediaLibrary
        initialItems={initialItems}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        query={q}
        slotBindings={MEDIA_SLOTS.map((slot) => {
          const current = approvedBySlot.get(slot.slot)
          return {
            ...slot,
            currentUrl: current?.url ?? null,
            currentAlt: current?.alt ?? null,
          }
        })}
      />
    </div>
  )
}
