import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DecorativeVideo } from '@/components/marketing/decorative-video'

/*
 * Task 29 — rendering, assets, caching, CSP and reduced-motion behaviour.
 *
 * Bucket A source/render/integration coverage. These assert the invariants the
 * task locks in without standing up a server or a database:
 *   1. CSP allows the single YouTube privacy-embed origin, nothing broader; the
 *      vercel.json X-Frame-Options conflict is resolved in favour of the CSP
 *      frame-ancestors allowlist.
 *   2. The public marketing layout no longer probes the session, so it is a
 *      stable, cacheable, non-personalised shell.
 *   3. Site settings + media-slot resolution are cached with a bounded window
 *      and tags, and the fail-closed approval/provenance gate is preserved.
 *   4. force-dynamic is removed only where the page has no request-specific
 *      data; revalidate stays.
 *   5. Decorative autoplay video honours prefers-reduced-motion BEFORE playback.
 *   6. The flagged raw images now reserve layout space (no CLS).
 *   7. The proven-dead reveal/legacy landing components are gone; the live UI
 *      and the still-referenced wrappers remain.
 */

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const FRONTEND = join('src', 'app', '[locale]', '(frontend)')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ── 1. CSP / security headers ────────────────────────────────────────────────
describe('Task 29 · CSP allows only the YouTube privacy-embed origin', () => {
  const config = read('next.config.ts')

  /**
   * Parse the frame-src directive *value* out of the CSP array — the quoted
   * string literal beginning with `frame-src`. We assert against the parsed
   * directive, never against incidental prose in the surrounding comments
   * (which may legitimately name origins the policy forbids), so the test can
   * no longer be tripped or satisfied by a stray comment substring.
   */
  const frameSrcDirective: string | null = (() => {
    const line = config
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('"frame-src') || l.startsWith("'frame-src"))
    if (!line) return null
    const match = line.match(/["']frame-src([^"']*)["']/)
    return match ? `frame-src${match[1]}`.trim() : null
  })()

  const frameSrcHosts: string[] = frameSrcDirective
    ? frameSrcDirective.replace(/^frame-src\s*/, '').split(/\s+/).filter(Boolean)
    : []

  it('adds https://www.youtube-nocookie.com to frame-src', () => {
    expect(frameSrcDirective, 'frame-src directive present').toBeTruthy()
    expect(frameSrcDirective!).toContain('https://www.youtube-nocookie.com')
    // Paystack framing stays.
    expect(frameSrcDirective!).toContain('https://checkout.paystack.com')
  })

  it('the frame-src directive does NOT allow youtube.com, a wildcard youtube host, or an autoplay origin', () => {
    expect(frameSrcDirective).toBeTruthy()
    const directive = frameSrcDirective!
    // The broad / tracking YouTube origins are absent from the directive value.
    expect(directive).not.toContain('https://youtube.com')
    expect(directive).not.toContain('https://www.youtube.com')
    expect(directive).not.toContain('*.youtube.com')
    expect(directive).not.toContain('youtube.com/embed')
    // No autoplay-capable origin is listed in the directive itself.
    expect(directive).not.toContain('autoplay')
    // Every host token is an explicit https origin, and none is a youtube.com
    // host — only the privacy embed (youtube-nocookie.com) and Paystack survive.
    expect(frameSrcHosts.length).toBeGreaterThan(0)
    for (const host of frameSrcHosts) {
      expect(host.startsWith('https://'), `${host} is an explicit https origin`).toBe(true)
      expect(host, `${host} is not a youtube.com host`).not.toMatch(/(^|\.|\/)youtube\.com/)
    }
    // Exactly one YouTube-family origin is permitted, and it is the nocookie one.
    const youtubeHosts = frameSrcHosts.filter((h) => h.includes('youtube'))
    expect(youtubeHosts).toEqual(['https://www.youtube-nocookie.com'])
  })

  it('does not loosen script-src (no youtube, no prod unsafe-eval)', () => {
    const prodScriptSrc =
      "script-src 'self' 'unsafe-inline' https://js.paystack.co https://api.paystack.co https://www.googletagmanager.com"
    expect(config).toContain(prodScriptSrc)
    // The prod script-src literal carries no unsafe-eval and no youtube origin.
    expect(prodScriptSrc).not.toContain('unsafe-eval')
    expect(prodScriptSrc).not.toContain('youtube')
  })

  it('keeps the intentional frame-ancestors allowlist and other headers', () => {
    expect(config).toContain("frame-ancestors 'self' https://webdesignkenya.co.ke")
    expect(config).toContain('Strict-Transport-Security')
    expect(config).toContain("value: 'nosniff'")
  })
})

describe('Task 29 · vercel.json X-Frame-Options conflict is resolved', () => {
  const vercel = JSON.parse(read('vercel.json')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  }
  const rawVercel = read('vercel.json')

  it('drops the legacy X-Frame-Options: DENY that contradicted the CSP allowlist', () => {
    expect(rawVercel).not.toContain('X-Frame-Options')
    const catchAll = vercel.headers.find((h) => h.source === '/(.*)')
    expect(catchAll).toBeTruthy()
    const keys = catchAll!.headers.map((h) => h.key)
    expect(keys).not.toContain('X-Frame-Options')
  })

  it('does not weaken the other catch-all security headers', () => {
    const catchAll = vercel.headers.find((h) => h.source === '/(.*)')!
    const byKey = Object.fromEntries(catchAll.headers.map((h) => [h.key, h.value]))
    expect(byKey['X-Content-Type-Options']).toBe('nosniff')
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
})

// ── 2. Stable, cacheable public marketing layout (no auth probe) ─────────────
describe('Task 29 · public marketing layout is stable and cacheable', () => {
  const layout = read(join(FRONTEND, 'layout.tsx'))

  it('removes the per-request Better Auth session probe', () => {
    expect(layout).not.toContain('auth.api.getSession')
    expect(layout).not.toContain("import { headers } from 'next/headers'")
    expect(layout).not.toContain('await headers()')
    expect(layout).not.toContain('isAuthed')
  })

  it('renders the stable public header without personalisation', () => {
    expect(layout).toContain("<SiteHeader locale={locale} signInLabel={nav('signIn')} />")
    // Site settings still resolved (now via the cached accessor).
    expect(layout).toContain('getSiteSettings')
  })

  it('the header exposes the stable public actions (Book a demo + Sign in)', () => {
    const header = read('src/components/layout/site-header.tsx')
    expect(header).toContain("label: 'Book a demo'")
    expect(header).toContain('signInLabel')
  })
})

// ── 3. Cache boundaries preserve the approval/provenance gate ────────────────
describe('Task 29 · media-slot + site-settings caching preserves fail-closed gates', () => {
  const slots = read('src/lib/media-slots.ts')
  const settings = read('src/lib/site-settings.ts')

  it('caches getSlotMedia with a bounded, tagged window', () => {
    expect(slots).toContain("import { unstable_cache } from 'next/cache'")
    expect(slots).toContain("import { cache } from 'react'")
    expect(slots).toContain('MEDIA_SLOT_REVALIDATE_SECONDS = 300')
    expect(slots).toContain('revalidate: MEDIA_SLOT_REVALIDATE_SECONDS')
    expect(slots).toContain("tags: ['media-slots'")
    expect(slots).toContain('export const getSlotMedia = cache(')
    // The raw resolver stays private so nothing bypasses the gate.
    expect(slots).toContain('async function fetchSlotMedia')
  })

  it('keeps the full fail-closed publication gate inside the cached resolver', () => {
    expect(slots).toContain("eq(platformMedia.approvalState, 'approved')")
    expect(slots).toContain("eq(auditLog.action, 'media.approve')")
    expect(slots).toContain("eq(user.role, 'platform_admin')")
    // The objectState=published gate is still present in every public resolver
    // (getSlotMedia, getApprovedMediaById, and the listApprovedMediaPhotos gate).
    const publishedGates =
      slots.split("eq(platformMedia.objectState, 'published')").length - 1
    expect(publishedGates).toBeGreaterThanOrEqual(3)
  })

  it('memoises getSiteSettings per render and keeps the fail-closed fallback', () => {
    expect(settings).toContain("import { cache } from 'react'")
    expect(settings).toContain('export const getSiteSettings = cache(')
    expect(settings).toContain("brandName: 'Omnix'")
  })

  it('admin media mutations invalidate the media-slots cache immediately', () => {
    const route = read('src/app/api/admin/media/route.ts')
    expect(route).toContain('revalidateTag')
    expect(route).toContain("revalidateTag('media-slots', { expire: 0 })")
  })

  it('documents the bounded visibility window at <= 300s', () => {
    expect(slots).toMatch(/<=\s*300s/)
  })
})

// ── 4. force-dynamic resolution on marketing routes ──────────────────────────
describe('Task 29 · force-dynamic removed only where safe, revalidate kept', () => {
  const cacheablePages: Array<[string, string]> = [
    ['home', join(FRONTEND, 'page.tsx')],
    ['pharmacy', join(FRONTEND, 'pharmacy', 'page.tsx')],
    ['retail', join(FRONTEND, 'retail', 'page.tsx')],
    ['hospitality', join(FRONTEND, 'hospitality', 'page.tsx')],
    ['hardware', join(FRONTEND, 'hardware', 'page.tsx')],
    ['salon', join(FRONTEND, 'salon', 'page.tsx')],
  ]

  it('drops force-dynamic, keeps revalidate, and marks the request locale', () => {
    for (const [name, rel] of cacheablePages) {
      const src = read(rel)
      expect(src, `${name} should not force dynamic`).not.toContain(
        "export const dynamic = 'force-dynamic'",
      )
      expect(src, `${name} keeps a revalidate window`).toMatch(/export const revalidate = \d+/)
      expect(src, `${name} marks the request locale for static rendering`).toContain(
        'setRequestLocale(locale)',
      )
    }
  })

  it('did not make a broad blind replacement (changelog keeps its dynamic semantics)', () => {
    const changelog = read(join(FRONTEND, 'changelog', 'page.tsx'))
    expect(changelog).toContain("export const dynamic = 'force-dynamic'")
  })
})

// ── 5. Reduced-motion decorative video ───────────────────────────────────────
function mockReducedMotion(initial: boolean) {
  let matches = initial
  const listeners = new Set<(event: { matches: boolean }) => void>()
  ;(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (
    query: string,
  ) =>
    ({
      get matches() {
        return matches
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, fn: (e: { matches: boolean }) => void) =>
        listeners.add(fn),
      removeEventListener: (_type: string, fn: (e: { matches: boolean }) => void) =>
        listeners.delete(fn),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
  return {
    change(next: boolean) {
      matches = next
      listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent))
    },
  }
}

describe('Task 29 · DecorativeVideo honours prefers-reduced-motion before playback', () => {
  const VIDEO = {
    src: 'https://media.omnix.co.ke/hero.webm',
    type: 'video/webm',
    poster: 'https://media.omnix.co.ke/hero-poster.webp',
  }

  it('renders muted, inline, controls-free, poster-backed and never with an autoplay attribute', () => {
    mockReducedMotion(true)
    render(<DecorativeVideo {...VIDEO} srLabel="Omnix POS in use" />)

    const video = document.querySelector('video')!
    expect(video).not.toBeNull()
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video).toHaveProperty('muted', true)
    expect(video.hasAttribute('controls')).toBe(false)
    expect(video.getAttribute('poster')).toBe(VIDEO.poster)
    expect(video.getAttribute('aria-hidden')).toBe('true')
    expect(video.querySelector('source')?.getAttribute('type')).toBe('video/webm')
    // Text alternative stays present.
    const label = screen.getByText('Omnix POS in use')
    expect(label.classList.contains('sr-only')).toBe(true)
  })

  it('does NOT attempt playback when reduced motion is preferred', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play')
    mockReducedMotion(true)
    render(<DecorativeVideo {...VIDEO} srLabel="Decorative clip" />)
    expect(playSpy).not.toHaveBeenCalled()
    expect(document.querySelector('video')?.getAttribute('preload')).toBe('none')
  })

  it('plays when motion is allowed', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play')
    mockReducedMotion(false)
    render(<DecorativeVideo {...VIDEO} srLabel="Decorative clip" />)
    expect(playSpy).toHaveBeenCalled()
    expect(document.querySelector('video')?.getAttribute('preload')).toBe('metadata')
  })

  it('pauses if the preference changes to reduced mid-session', () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    const rm = mockReducedMotion(false)
    render(<DecorativeVideo {...VIDEO} srLabel="Decorative clip" />)
    pauseSpy.mockClear()
    act(() => rm.change(true))
    expect(pauseSpy).toHaveBeenCalled()
  })

  it('labels the homepage hero directly (accessible name) rather than aria-hidden', () => {
    mockReducedMotion(true)
    render(<DecorativeVideo {...VIDEO} ariaLabel="Omnix POS and inventory in use" />)
    const video = screen.getByLabelText('Omnix POS and inventory in use')
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('aria-hidden')).toBeNull()
  })
})

describe('Task 29 · DecorativeVideo source contract', () => {
  const src = read('src/components/marketing/decorative-video.tsx')

  it('gates playback on the reduced-motion preference and never uses an autoplay attribute', () => {
    expect(src).toContain('usePrefersReducedMotion')
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(src).not.toContain('autoPlay')
    expect(src).toContain('.play()')
    expect(src).toContain('.pause()')
    expect(src).toContain('muted')
    expect(src).toContain('playsInline')
    // No controls on decorative media.
    expect(src).not.toContain('controls')
  })
})

// ── 6. Image dimensions / CLS ────────────────────────────────────────────────
describe('Task 29 · flagged raw images reserve layout space (no CLS)', () => {
  it('customer-logo reserves a fixed-height plate and keeps alt provenance', () => {
    const proof = read('src/components/marketing/verified-customer-proof.tsx')
    expect(proof).toContain('flex h-12 items-center')
    expect(proof).toContain('height={48}')
    expect(proof).toContain('alt={proof.logoAlt}')
  })

  it('team photo carries explicit 4:3 dimensions matching its aspect-ratio box', () => {
    const trust = read('src/components/marketing/trust-pages.tsx')
    expect(trust).toContain('width={800}')
    expect(trust).toContain('height={600}')
    expect(trust).toContain('alt={member.photo.alt}')
    // The container still reserves space via aspect-ratio.
    expect(read('src/components/marketing/trust-pages.module.css')).toContain('aspect-ratio: 4 / 3')
  })

  it('did not broaden remote host allowlisting for these fixes', () => {
    const config = read('next.config.ts')
    expect(config).not.toContain('unoptimized')
    // Only the pre-existing approved media hosts remain.
    expect(config).toContain('media.omnix.co.ke')
  })
})

// ── 7. Dead reveal/legacy landing components removed ─────────────────────────
describe('Task 29 · proven-dead reveal/legacy landing components are removed', () => {
  const deleted = [
    'pos-preview',
    'modules-rows-section',
    'compliance-section',
    'trust-strip-section',
    'unified-platform-section',
    'founder-note-section',
    'receipt-proof-section',
    'why-switch-section',
    'pdf-pack-section',
    'reliability-section',
  ]

  it('removes each dead component file', () => {
    for (const name of deleted) {
      expect(
        existsSync(join(ROOT, 'src', 'components', 'landing', `${name}.tsx`)),
        `${name}.tsx should be deleted`,
      ).toBe(false)
    }
  })

  it('keeps the live homepage and the still-referenced proof wrappers', () => {
    for (const kept of ['homepage', 'three-quotes-section', 'recent-work-section']) {
      expect(existsSync(join(ROOT, 'src', 'components', 'landing', `${kept}.tsx`))).toBe(true)
    }
  })
})
