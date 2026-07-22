import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  MODULE_DEMO_PRODUCTS,
  isModuleDemoProduct,
  isValidYouTubeVideoId,
  parseYouTubeUrl,
  toPublicModuleDemoVideo,
  youTubeNoCookieEmbedUrl,
} from '@/lib/youtube-demo'
import { ModuleDemoVideoInput } from '@/lib/youtube-demo-input'
import { ModuleDemoVideo } from '@/components/marketing/module-demo-video'
import { adminNavigationForRole } from '@/components/admin/admin-navigation'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const FRONTEND = join('src', 'app', '[locale]', '(frontend)')
const VALID_ID = 'dQw4w9WgXcQ'

afterEach(cleanup)

describe('Task 34 · module demo videos — exact five product mapping', () => {
  it('covers exactly the five product pages, and nothing else', () => {
    expect([...MODULE_DEMO_PRODUCTS]).toEqual(['pharmacy', 'retail', 'hospitality', 'hardware', 'salon'])
    expect(MODULE_DEMO_PRODUCTS).toHaveLength(5)
    for (const product of MODULE_DEMO_PRODUCTS) expect(isModuleDemoProduct(product)).toBe(true)
    for (const other of ['electronics', 'core', 'pro', '', 'PHARMACY', null, 7]) {
      expect(isModuleDemoProduct(other)).toBe(false)
    }
  })
})

describe('Task 34 · pure URL validator', () => {
  it('accepts supported hosts and extracts the 11-char video ID', () => {
    const accepted: Array<[string, string]> = [
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', VALID_ID],
      ['https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghij', VALID_ID],
      ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', VALID_ID],
      ['https://youtu.be/dQw4w9WgXcQ', VALID_ID],
      ['https://youtu.be/dQw4w9WgXcQ?t=42', VALID_ID],
      ['https://www.youtube.com/shorts/dQw4w9WgXcQ', VALID_ID],
      ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', VALID_ID],
      ['https://youtube-nocookie.com/embed/dQw4w9WgXcQ', VALID_ID],
      ['  https://youtu.be/dQw4w9WgXcQ  ', VALID_ID],
    ]
    for (const [input, id] of accepted) {
      const result = parseYouTubeUrl(input)
      expect(result.ok, `expected ${input} to parse`).toBe(true)
      if (result.ok) expect(result.videoId).toBe(id)
    }
  })

  it('rejects other hosts, userinfo, ports, deceptive subdomains, HTML, playlists, and bad IDs', () => {
    const rejected = [
      'https://vimeo.com/123456789',
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', // deceptive subdomain
      'https://evil-youtube.com/watch?v=dQw4w9WgXcQ',
      'https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ', // userinfo
      'https://www.youtube.com:8080/watch?v=dQw4w9WgXcQ', // port
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', // embed HTML
      'https://www.youtube.com/playlist?list=PLabcdefghij', // playlist only
      'https://www.youtube.com/watch', // no video id
      'https://www.youtube.com/watch?v=short', // invalid id (too short)
      'https://youtu.be/dQw4w9WgXcQextra', // invalid id (too long)
      'https://youtu.be/dQw4w9WgXcQ/extra', // extra path segment
      'https://www.youtube.com/embed/dQw4w9WgXcQ', // youtube.com/embed not supported
      'https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ', // nocookie watch not supported
      'javascript:alert(1)',
      'ftp://youtube.com/watch?v=dQw4w9WgXcQ',
      'not a url',
      '',
      '   ',
      null,
      42,
      { url: 'https://youtu.be/dQw4w9WgXcQ' },
    ]
    for (const input of rejected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = parseYouTubeUrl(input as any)
      expect(result.ok, `expected ${String(input)} to be rejected`).toBe(false)
      if (!result.ok) expect(typeof result.error).toBe('string')
    }
  })

  it('validates raw 11-char IDs and builds only nocookie embed URLs', () => {
    expect(isValidYouTubeVideoId('dQw4w9WgXcQ')).toBe(true)
    expect(isValidYouTubeVideoId('too-short')).toBe(false)
    expect(isValidYouTubeVideoId('waytoolongvideoid')).toBe(false)
    expect(isValidYouTubeVideoId('bad id chars')).toBe(false)
    expect(youTubeNoCookieEmbedUrl(VALID_ID)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })
})

describe('Task 34 · strict admin input schema', () => {
  const base = { product: 'pharmacy', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Demo', summary: 'Summary', published: true }

  it('accepts a well-formed body', () => {
    expect(ModuleDemoVideoInput.safeParse(base).success).toBe(true)
    expect(ModuleDemoVideoInput.safeParse({ ...base, url: '', published: false }).success).toBe(true)
  })

  it('rejects extra/unsupported fields and wrong types', () => {
    expect(ModuleDemoVideoInput.safeParse({ ...base, embedHtml: '<iframe>' }).success).toBe(false)
    expect(ModuleDemoVideoInput.safeParse({ ...base, published: 'yes' }).success).toBe(false)
    expect(ModuleDemoVideoInput.safeParse({ ...base, product: 'electronics' }).success).toBe(false)
    const { product: _drop, ...missing } = base
    expect(ModuleDemoVideoInput.safeParse(missing).success).toBe(false)
  })
})

describe('Task 34 · fail-closed public transform', () => {
  const complete = { product: 'pharmacy', videoId: VALID_ID, title: 'Pharmacy demo', summary: 'A short walkthrough', published: true }

  it('returns a public entry only for a complete, published, valid row', () => {
    expect(toPublicModuleDemoVideo(complete)).toEqual({
      product: 'pharmacy',
      videoId: VALID_ID,
      title: 'Pharmacy demo',
      summary: 'A short walkthrough',
    })
  })

  it('fails closed on missing/unpublished/invalid/incomplete rows', () => {
    expect(toPublicModuleDemoVideo(null)).toBeNull()
    expect(toPublicModuleDemoVideo(undefined)).toBeNull()
    expect(toPublicModuleDemoVideo({ ...complete, published: false })).toBeNull()
    expect(toPublicModuleDemoVideo({ ...complete, videoId: '' })).toBeNull()
    expect(toPublicModuleDemoVideo({ ...complete, videoId: 'https://youtu.be/x' })).toBeNull()
    expect(toPublicModuleDemoVideo({ ...complete, product: 'electronics' })).toBeNull()
    expect(toPublicModuleDemoVideo({ ...complete, title: '   ' })).toBeNull()
    expect(toPublicModuleDemoVideo({ ...complete, summary: '' })).toBeNull()
  })

  it('resolver wraps DB access and fails closed to null', () => {
    const resolver = read('src/lib/module-demo-video.ts')
    expect(resolver).toContain('try {')
    expect(resolver).toContain('catch {')
    expect(resolver).toContain('return null')
    expect(resolver).toContain('toPublicModuleDemoVideo')
  })
})

describe('Task 34 · shared component privacy boundary + safe embed', () => {
  it('renders no iframe before the explicit Play action, then only a nocookie embed', () => {
    render(
      <ModuleDemoVideo
        product="pharmacy"
        productLabel="Pharmacy"
        content={{ videoId: VALID_ID, title: 'Pharmacy walkthrough', summary: 'Dispense, pay, review.' }}
        bookDemoHref="/ke/contact?type=demo&product=pharmacy"
      />,
    )

    // Before click: no YouTube iframe exists at all.
    expect(document.querySelector('iframe')).toBeNull()
    const play = screen.getByRole('button', { name: /Play the Pharmacy demo video/i })
    expect(screen.getByText('Dispense, pay, review.')).not.toBeNull()

    fireEvent.click(play)

    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(iframe?.getAttribute('src')).not.toContain('autoplay')
    expect(iframe?.getAttribute('title')).toBe('Pharmacy walkthrough')
    expect(iframe?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(iframe?.getAttribute('allow')).toContain('fullscreen')
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true)
    // The text summary stays visible alongside the embed.
    expect(screen.getByText('Dispense, pay, review.')).not.toBeNull()
  })

  it('shows the being-prepared state with a book-demo link when no video is published', () => {
    render(
      <ModuleDemoVideo
        product="salon"
        productLabel="Salon & Spa"
        content={null}
        bookDemoHref="/fr/contact?type=demo&product=salon"
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Demo video is being prepared.' })).not.toBeNull()
    const link = screen.getByRole('link', { name: 'Book a guided demo' })
    expect(link.getAttribute('href')).toBe('/fr/contact?type=demo&product=salon')
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('never accepts a raw URL as an embeddable ID (invalid id → being-prepared, no iframe)', () => {
    render(
      <ModuleDemoVideo
        product="retail"
        productLabel="Retail"
        content={{ videoId: 'https://youtube.com/watch?v=dQw4w9WgXcQ', title: 'T', summary: 'S' }}
        bookDemoHref="/ke/contact?type=demo&product=retail"
      />,
    )
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByText('Demo video is being prepared.')).not.toBeNull()
  })

  it('component source only ever builds the nocookie embed origin', () => {
    const source = read('src/components/marketing/module-demo-video.tsx')
    expect(source).toContain('youTubeNoCookieEmbedUrl')
    expect(source).not.toContain('www.youtube.com/embed')
    expect(source).toContain("useState")
  })
})

describe('Task 34 · admin auth gates and audit events', () => {
  it('enforces platform_admin server-side in the API route and page', () => {
    const route = read('src/app/api/admin/module-videos/route.ts')
    expect(route).toContain('auth.api.getSession')
    expect(route).toContain("session.user.role !== 'platform_admin'")
    expect(route).toContain('ModuleDemoVideoInput')
    expect(route).toContain('parseYouTubeUrl')

    const page = read('src/app/admin/module-videos/page.tsx')
    expect(page).toContain("session.user.role !== 'platform_admin'")
    expect(page).toContain("redirect('/admin')")
  })

  it('records create / update / publish / unpublish audit events without secrets', () => {
    const route = read('src/app/api/admin/module-videos/route.ts')
    expect(route).toContain('module_demo_video.create')
    expect(route).toContain('module_demo_video.update')
    expect(route).toContain('module_demo_video.publish')
    expect(route).toContain('module_demo_video.unpublish')
    expect(route).toContain('auditLog')
    // Persists the normalised id, not the raw URL.
    expect(route).toContain('videoId,')
  })

  it('surfaces the admin route only to platform_admin in navigation', () => {
    const href = '/admin/module-videos'
    const hrefsFor = (role: string) => adminNavigationForRole(role).flatMap((g) => g.items.map((i) => i.href))
    expect(hrefsFor('platform_admin')).toContain(href)
    expect(hrefsFor('support_agent')).not.toContain(href)
    expect(hrefsFor('sales_rep')).not.toContain(href)
    expect(hrefsFor('user')).not.toContain(href)
  })

  it('documents why search/pagination does not apply to the fixed five', () => {
    const client = read('src/app/admin/module-videos/module-videos-client.tsx')
    expect(client.toLowerCase()).toContain('no search or pagination')
  })
})

describe('Task 34 · schema and migration parity', () => {
  const columns = ['product', 'video_id', 'title', 'summary', 'published', 'updated_by']

  it('defines the durable typed schema', () => {
    const schema = read('src/db/schema/module_demo_videos.ts')
    expect(schema).toContain("pgTable(\n  'module_demo_videos'")
    for (const column of columns) expect(schema).toContain(`'${column}'`)
    expect(schema).toContain('module_demo_videos_product_uidx')
    expect(read('src/db/schema/index.ts')).toContain("export * from './module_demo_videos'")
  })

  it('ships an idempotent next migration (0007) with matching columns', () => {
    const migration = read('drizzle/migrations/0007_module_demo_videos.sql')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_demo_videos"')
    for (const column of columns) expect(migration).toContain(`"${column}"`)
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "module_demo_videos_product_uidx"')
    expect(migration).toContain('module_demo_videos_updated_by_user_id_fk')
  })

  it('inlines the same table into the serverless migration path', () => {
    const inline = read('src/db/migration-sql.ts')
    expect(inline).toContain('CREATE TABLE IF NOT EXISTS "module_demo_videos"')
    for (const column of columns) expect(inline).toContain(`"${column}"`)
    expect(inline).toContain('module_demo_videos_product_uidx')
  })
})

describe('Task 34 · wiring into exactly the five product pages', () => {
  const pages: Array<[string, string]> = [
    ['pharmacy', 'pharmacy'],
    ['retail', 'retail'],
    ['hospitality', 'hospitality'],
    ['hardware', 'hardware'],
    ['salon', 'salon'],
  ]

  it('each product page resolves and passes the demo video', () => {
    for (const [dir, product] of pages) {
      const page = read(join(FRONTEND, dir, 'page.tsx'))
      expect(page).toContain('getPublishedModuleDemoVideo')
      expect(page).toContain(`getPublishedModuleDemoVideo('${product}')`)
      expect(page).toContain('demoVideo={demoVideo}')
    }
  })

  it('each product website renders the shared demo component', () => {
    for (const [dir] of pages) {
      const component = read(`src/components/marketing/${dir}-website.tsx`)
      expect(component).toContain('ModuleDemoVideo')
      expect(component).toContain('demoVideo')
    }
  })
})
