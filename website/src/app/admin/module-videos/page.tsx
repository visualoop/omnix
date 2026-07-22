import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, moduleDemoVideos } from '@/db'
import { auth } from '@/lib/auth'
import { MODULE_DEMO_PRODUCTS, type ModuleDemoProduct } from '@/lib/youtube-demo'
import { ModuleVideosClient, type ModuleVideoRow } from './module-videos-client'

export const dynamic = 'force-dynamic'

const PRODUCT_LABELS: Record<ModuleDemoProduct, string> = {
  pharmacy: 'Pharmacy',
  retail: 'Retail',
  hospitality: 'Hospitality',
  hardware: 'Hardware & Equipment',
  salon: 'Salon & Spa',
}

export default async function AdminModuleVideosPage() {
  // Server-side gate (the API route is the security boundary of record; this
  // mirrors the platform_admin-only convention used by /admin/media etc.).
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?next=/admin/module-videos')
  if (session.user.role !== 'platform_admin') redirect('/admin')

  const rows = await db.select().from(moduleDemoVideos).catch(() => [])
  const byProduct = new Map(rows.map((row) => [row.product, row]))

  const initial: ModuleVideoRow[] = MODULE_DEMO_PRODUCTS.map((product) => {
    const row = byProduct.get(product)
    return {
      product,
      label: PRODUCT_LABELS[product],
      videoId: row?.videoId ?? '',
      title: row?.title ?? '',
      summary: row?.summary ?? '',
      published: row?.published ?? false,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    }
  })

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
          Marketing site · product demos
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="mt-1 text-[28px] font-medium tracking-[-0.01em]">
          Module demo videos
        </h1>
        <p className="mt-1 max-w-[72ch] text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
          One YouTube demo per product page. Paste a YouTube link — we store the normalised video ID only,
          never embed HTML. A video appears publicly (loaded on click, from youtube-nocookie.com) only once
          it has a title, a text summary, and is published. Clearing the link or unpublishing removes it
          from the public page immediately.
        </p>
      </header>

      <ModuleVideosClient initial={initial} />
    </div>
  )
}
