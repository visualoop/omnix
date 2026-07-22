import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Task 29 — bucket C: privacy-safe acquisition measurement.
 *
 * Source + render/integration coverage that locks the invariants without a
 * server or a database:
 *   1. GA id validation gates everything (missing/invalid → nothing, no banner).
 *   2. No Google script or gtag exists before an explicit Accept.
 *   3. Accept loads exactly one GA tag; Decline / GPC / DNT never load it.
 *   4. page_view is path-only (no query, hash, referrer, or full URL).
 *   5. trackConversion is a closed, no-PII payload and no-ops without a tag.
 *   6. The high-value public controls are instrumented (product+locale+surface).
 *   7. CSP names only the exact Google hosts; layout drops @next/third-parties.
 *   8. The privacy page describes the opt-in analytics honestly.
 */

// next/navigation is mocked so the client SiteAnalytics island renders.
let mockPathname = '/ke'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

import { GA_ID_PATTERN, isValidGaId, resolveGaId } from '@/lib/analytics/ga'
import {
  CONSENT_STORAGE_KEY,
  isConsentChoice,
  isPrivacySignalActive,
  readStoredConsent,
  writeStoredConsent,
} from '@/lib/analytics/consent'
import {
  CONVERSION_EVENTS,
  normalizePublicPath,
  pathOnly,
  sendPageView,
  trackConversion,
} from '@/lib/analytics/track'
import {
  __resetConsentStoreForTests,
  openAnalyticsPreferences,
} from '@/lib/analytics/consent-store'
import { SiteAnalytics } from '@/components/analytics/site-analytics'
import { ModuleDemoVideo } from '@/components/marketing/module-demo-video'
import { WhatsAppWidget } from '@/components/marketing/whatsapp-widget'
import { DemoBookingForm } from '@/components/marketing/demo-booking-form'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const GA_ID = 'G-TEST123456'

interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void
  dataLayer?: unknown[]
}

function setGpc(value: unknown) {
  Object.defineProperty(window.navigator, 'globalPrivacyControl', { configurable: true, value })
}
function setDnt(value: unknown) {
  Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, value })
}
function clearPrivacySignals() {
  setGpc(undefined)
  setDnt(null)
}

beforeEach(() => {
  mockPathname = '/ke'
  clearPrivacySignals()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  try {
    window.localStorage.clear()
  } catch {
    /* ignore */
  }
  __resetConsentStoreForTests()
  document.getElementById('omnix-ga-tag')?.remove()
  const w = window as unknown as GtagWindow & Record<string, unknown>
  delete w.gtag
  delete w.dataLayer
  for (const key of Object.keys(w)) {
    if (key.startsWith('ga-disable-')) delete w[key]
  }
  clearPrivacySignals()
})

function renderAnalytics(gaId = GA_ID) {
  return render(<SiteAnalytics gaId={gaId} privacyHref="/ke/privacy" />)
}

// ── 1. GA id validation ──────────────────────────────────────────────────────
describe('Task 29 · GA id is validated by a safe regex', () => {
  it('accepts a well-formed GA4 id and nothing else', () => {
    expect(isValidGaId('G-ABCDE12345')).toBe(true)
    expect(GA_ID_PATTERN.test('G-TEST123456')).toBe(true)
    for (const bad of ['', 'g-abcde12345', 'GTM-ABCDE', 'UA-123', 'G-abc', 'G-@@@@', 'javascript:1', 'G-<script>']) {
      expect(isValidGaId(bad), `${bad} rejected`).toBe(false)
    }
  })

  it('resolveGaId trims and returns null for missing/invalid', () => {
    expect(resolveGaId('  G-ABCDE12345  ')).toBe('G-ABCDE12345')
    expect(resolveGaId(undefined)).toBeNull()
    expect(resolveGaId('')).toBeNull()
    expect(resolveGaId('not-a-ga-id')).toBeNull()
  })
})

// ── 2. Consent primitives ────────────────────────────────────────────────────
describe('Task 29 · consent primitives (localStorage only, GPC/DNT aware)', () => {
  it('reads/writes a choice without any cookie', () => {
    const store = window.localStorage
    expect(readStoredConsent(store)).toBe('unset')
    writeStoredConsent('granted', store)
    expect(store.getItem(CONSENT_STORAGE_KEY)).toBe('granted')
    expect(readStoredConsent(store)).toBe('granted')
    writeStoredConsent('denied', store)
    expect(readStoredConsent(store)).toBe('denied')
    expect(isConsentChoice('granted')).toBe(true)
    expect(isConsentChoice('maybe')).toBe(false)
  })

  it('detects GPC and DNT positive signals', () => {
    expect(isPrivacySignalActive({ gpc: true })).toBe(true)
    expect(isPrivacySignalActive({ gpc: '1' })).toBe(true)
    expect(isPrivacySignalActive({ dnt: '1' })).toBe(true)
    expect(isPrivacySignalActive({ dnt: 'yes' })).toBe(true)
    expect(isPrivacySignalActive({ gpc: false, dnt: '0' })).toBe(false)
    expect(isPrivacySignalActive({})).toBe(false)
  })
})

// ── 3. No script/gtag before consent; invalid id renders nothing ─────────────
describe('Task 29 · nothing loads before an explicit Accept', () => {
  it('an invalid/missing id renders no banner and no script', () => {
    const { container } = renderAnalytics('not-valid')
    expect(container.innerHTML).toBe('')
    expect(document.querySelector('[data-analytics-consent]')).toBeNull()
    expect(document.getElementById('omnix-ga-tag')).toBeNull()
    expect((window as GtagWindow).gtag).toBeUndefined()
  })

  it('first visit shows the notice but loads no Google script or gtag', () => {
    renderAnalytics()
    const notice = document.querySelector('[data-analytics-consent]')
    expect(notice).not.toBeNull()
    expect(notice?.getAttribute('data-state')).toBe('prompt')
    expect(document.getElementById('omnix-ga-tag')).toBeNull()
    expect((window as GtagWindow).gtag).toBeUndefined()
    // GA is held disabled until a granted choice exists.
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(true)
    // Equal, clearly labelled choices — no dark pattern.
    expect(screen.getByRole('button', { name: 'Accept analytics' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No thanks' })).toBeTruthy()
  })
})

// ── 4. Accept / Decline / GPC / DNT ──────────────────────────────────────────
describe('Task 29 · consent decisions gate the exact GA tag', () => {
  it('Accept loads exactly one GA tag from googletagmanager and dismisses the notice', () => {
    renderAnalytics()
    fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }))

    const script = document.getElementById('omnix-ga-tag') as HTMLScriptElement | null
    expect(script).not.toBeNull()
    expect(script!.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
    expect(document.querySelectorAll('#omnix-ga-tag')).toHaveLength(1)
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(false)
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('granted')
    expect(document.querySelector('[data-analytics-consent]')).toBeNull()
  })

  it('Decline loads no script, keeps GA disabled, and dismisses the notice', () => {
    renderAnalytics()
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }))
    expect(document.getElementById('omnix-ga-tag')).toBeNull()
    expect((window as GtagWindow).gtag).toBeUndefined()
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(true)
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied')
    expect(document.querySelector('[data-analytics-consent]')).toBeNull()
  })

  it('GPC defaults to denied: no banner, no script', () => {
    setGpc(true)
    renderAnalytics()
    expect(document.querySelector('[data-analytics-consent]')).toBeNull()
    expect(document.getElementById('omnix-ga-tag')).toBeNull()
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(true)
  })

  it('DNT defaults to denied: no banner, no script', () => {
    setDnt('1')
    renderAnalytics()
    expect(document.querySelector('[data-analytics-consent]')).toBeNull()
    expect(document.getElementById('omnix-ga-tag')).toBeNull()
  })

  it('the footer preferences control reopens the notice without clearing storage', () => {
    renderAnalytics()
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }))
    expect(document.querySelector('[data-analytics-consent]')).toBeNull()
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied')

    act(() => openAnalyticsPreferences())
    const notice = document.querySelector('[data-analytics-consent]')
    expect(notice).not.toBeNull()
    expect(notice?.getAttribute('data-state')).toBe('preferences')
    expect(screen.getByText(/Analytics is currently off/i)).toBeTruthy()
    // Storage still holds the previous choice — reopening never cleared it.
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied')
  })

  it('under GPC the reopened preferences view explains and never offers enable', () => {
    setGpc(true)
    renderAnalytics()
    act(() => openAnalyticsPreferences())
    const notice = document.querySelector('[data-analytics-consent]')
    expect(notice?.getAttribute('data-state')).toBe('privacy-signal')
    expect(screen.getByText(/Do Not Track signal/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept analytics' })).toBeNull()
  })
})

// ── 5. Strict, path-only page view; no query / hash / referrer / title / PII ──
describe('Task 29 · page_view is a strict, closed, path-only report', () => {
  it('pathOnly strips query and hash', () => {
    expect(pathOnly('/ke/pharmacy?utm_source=x&ref=y#frag')).toBe('/ke/pharmacy')
    expect(pathOnly('')).toBe('/')
    expect(pathOnly('ke')).toBe('/ke')
  })

  it('sends only origin+path and path for a known route — never query, hash, referrer, or title', () => {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    document.title = 'Pharmacy · Omnix'

    sendPageView('/ke/pharmacy?utm_source=google&email=a@b.com#top')

    expect(gtag).toHaveBeenCalledTimes(1)
    const [event, name, params] = gtag.mock.calls[0] as [string, string, Record<string, string>]
    expect(event).toBe('event')
    expect(name).toBe('page_view')
    expect(params.page_path).toBe('/ke/pharmacy')
    expect(params.page_location.endsWith('/ke/pharmacy')).toBe(true)
    // No query, hash, referrer, or full-URL leakage.
    const serialized = JSON.stringify(params)
    expect(serialized).not.toContain('utm_source')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('a@b.com')
    expect(serialized).not.toContain('#top')
    expect(serialized).not.toContain('referrer')
    // The document title is a free-form surface and is deliberately dropped.
    expect(serialized).not.toContain('Pharmacy · Omnix')
    expect(Object.keys(params).sort()).toEqual(['page_location', 'page_path'])
  })

  it('no-ops when no tag is loaded', () => {
    expect(() => sendPageView('/ke')).not.toThrow()
  })
})

// ── 5b. The closed path normalizer is the only surface a path can reach ──────
describe('Task 29 · normalizePublicPath is a closed allowlist', () => {
  it('maps the localized home and exact known routes to themselves', () => {
    expect(normalizePublicPath('/ke')).toBe('/ke')
    expect(normalizePublicPath('/ke/pharmacy')).toBe('/ke/pharmacy')
    expect(normalizePublicPath('/us/pricing')).toBe('/us/pricing')
    expect(normalizePublicPath('/sw/contact')).toBe('/sw/contact')
    // Index pages of the authored families are exact routes too.
    expect(normalizePublicPath('/ke/blog')).toBe('/ke/blog')
    expect(normalizePublicPath('/ke/docs')).toBe('/ke/docs')
  })

  it('collapses authored detail families to a fixed template — never the slug', () => {
    expect(normalizePublicPath('/ke/blog/how-we-price-2026')).toBe('/ke/blog/article')
    expect(normalizePublicPath('/ke/docs/getting-started')).toBe('/ke/docs/article')
    expect(normalizePublicPath('/ke/guides/kra-etims')).toBe('/ke/guides/article')
    expect(normalizePublicPath('/ke/locations/nairobi-cbd')).toBe('/ke/locations/place')
    expect(normalizePublicPath('/ke/modules/inventory')).toBe('/ke/modules/detail')
  })

  it('strips query and hash before matching', () => {
    expect(normalizePublicPath('/ke/pharmacy?utm=x#top')).toBe('/ke/pharmacy')
    expect(normalizePublicPath('/ke/blog/secret-slug?ref=a#b')).toBe('/ke/blog/article')
  })

  it('sends any other localized path to /<locale>/not-found — never the attempted path', () => {
    expect(normalizePublicPath('/ke/person@example.com')).toBe('/ke/not-found')
    expect(normalizePublicPath('/ke/totally-made-up')).toBe('/ke/not-found')
    expect(normalizePublicPath('/ke/pharmacy/extra/segments')).toBe('/ke/not-found')
    // A checkout/auth path that somehow acquired a locale prefix still cannot leak.
    expect(normalizePublicPath('/ke/buy/success')).toBe('/ke/not-found')
    expect(normalizePublicPath('/ke/dashboard/licenses/abc-123')).toBe('/ke/not-found')
  })

  it('returns null (no event) for non-localized paths — checkout, auth, dashboard, admin', () => {
    expect(normalizePublicPath('/login')).toBeNull()
    expect(normalizePublicPath('/signup')).toBeNull()
    expect(normalizePublicPath('/buy/success')).toBeNull()
    expect(normalizePublicPath('/dashboard/billing')).toBeNull()
    expect(normalizePublicPath('/admin/users/42')).toBeNull()
    expect(normalizePublicPath('/')).toBeNull()
  })
})

describe('Task 29 · sendPageView can never carry a raw slug, PII, or private path', () => {
  function capture(path: string) {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    sendPageView(path)
    return gtag
  }

  it('a PII-looking slug never reaches the payload', () => {
    const gtag = capture('/ke/person@example.com')
    const params = gtag.mock.calls[0]?.[2] as Record<string, string>
    expect(params.page_path).toBe('/ke/not-found')
    const serialized = JSON.stringify(gtag.mock.calls)
    expect(serialized).not.toContain('person@example.com')
    expect(serialized).not.toContain('@example.com')
  })

  it('an arbitrary authored slug collapses to its template', () => {
    const gtag = capture('/ke/blog/my-private-draft-title-2026')
    const params = gtag.mock.calls[0][2] as Record<string, string>
    expect(params.page_path).toBe('/ke/blog/article')
    expect(JSON.stringify(gtag.mock.calls)).not.toContain('my-private-draft-title-2026')
  })

  it('query and hash never reach the payload', () => {
    const gtag = capture('/ke/pricing?email=a@b.com&utm_source=x#section')
    const serialized = JSON.stringify(gtag.mock.calls)
    expect(serialized).not.toContain('a@b.com')
    expect(serialized).not.toContain('utm_source')
    expect(serialized).not.toContain('#section')
    expect((gtag.mock.calls[0][2] as Record<string, string>).page_path).toBe('/ke/pricing')
  })

  it('a checkout/auth path with a locale prefix reports only /<locale>/not-found', () => {
    const gtag = capture('/ke/buy/ORDER-abc123')
    expect((gtag.mock.calls[0][2] as Record<string, string>).page_path).toBe('/ke/not-found')
    expect(JSON.stringify(gtag.mock.calls)).not.toContain('ORDER-abc123')
  })

  it('a non-localized private path sends no event at all', () => {
    const gtag = capture('/dashboard/licenses/secret-license-id')
    expect(gtag).not.toHaveBeenCalled()
  })

  it('known product paths pass through unchanged', () => {
    for (const p of ['/ke/pharmacy', '/ke/retail', '/ke/hospitality', '/ke/hardware', '/ke/salon']) {
      const gtag = capture(p)
      expect((gtag.mock.calls[0][2] as Record<string, string>).page_path).toBe(p)
    }
  })
})

describe('Task 29 · SiteAnalytics never puts a raw path or PII into the GA dataLayer', () => {
  function acceptAndLoad() {
    fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }))
    const script = document.getElementById('omnix-ga-tag') as HTMLScriptElement
    // Simulate the async gtag.js finishing load → initGa fires the first page_view.
    fireEvent.load(script)
    return script
  }

  it('a PII-looking initial path is recorded as /<locale>/not-found only', () => {
    mockPathname = '/ke/person@example.com'
    renderAnalytics()
    acceptAndLoad()
    const serialized = JSON.stringify((window as GtagWindow).dataLayer ?? [])
    expect(serialized).not.toContain('person@example.com')
    expect(serialized).toContain('/ke/not-found')
  })

  it('an authored detail slug is recorded as the family template only', () => {
    mockPathname = '/ke/blog/an-unpublished-secret-slug'
    renderAnalytics()
    acceptAndLoad()
    const serialized = JSON.stringify((window as GtagWindow).dataLayer ?? [])
    expect(serialized).not.toContain('an-unpublished-secret-slug')
    expect(serialized).toContain('/ke/blog/article')
  })

  it('a known product path is recorded unchanged', () => {
    mockPathname = '/ke/pharmacy'
    renderAnalytics()
    acceptAndLoad()
    const serialized = JSON.stringify((window as GtagWindow).dataLayer ?? [])
    expect(serialized).toContain('/ke/pharmacy')
  })
})

// ── 6. Closed conversion payloads ────────────────────────────────────────────
describe('Task 29 · trackConversion is a closed, no-PII payload', () => {
  it('no-ops unless a tag is loaded', () => {
    expect(() => trackConversion('generate_lead', { product: 'pharmacy' })).not.toThrow()
  })

  it('sends only the recognised event + closed dimensions', () => {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    trackConversion('generate_lead', { product: 'pharmacy', locale: 'ke', surface: 'demo_form' })
    expect(gtag).toHaveBeenCalledWith('event', 'generate_lead', {
      product: 'pharmacy',
      locale: 'ke',
      surface: 'demo_form',
    })
  })

  it('drops unknown products, locales, surfaces, and any extra fields', () => {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    // Cast through unknown to simulate a bad caller — invalid values are dropped.
    trackConversion('whatsapp_click', {
      product: 'bogus',
      locale: 'zz',
      surface: 'nope',
      email: 'a@b.com',
      name: 'Jane',
    } as unknown as Parameters<typeof trackConversion>[1])
    expect(gtag).toHaveBeenCalledWith('event', 'whatsapp_click', {})
    const params = gtag.mock.calls[0][2] as Record<string, string>
    expect(JSON.stringify(params)).not.toContain('a@b.com')
    expect(JSON.stringify(params)).not.toContain('Jane')
  })

  it('exposes the closed event union including begin_checkout', () => {
    expect([...CONVERSION_EVENTS].sort()).toEqual(
      ['begin_checkout', 'generate_lead', 'video_start', 'whatsapp_click'],
    )
  })
})

// ── 7. Instrumented public controls ──────────────────────────────────────────
describe('Task 29 · high-value public controls are instrumented', () => {
  it('ModuleDemoVideo fires video_start on the explicit Play (product+locale+surface)', () => {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    render(
      <ModuleDemoVideo
        product="pharmacy"
        productLabel="Pharmacy"
        content={{ videoId: 'dQw4w9WgXcQ', title: 'Pharmacy walkthrough', summary: 'Dispense, pay, review.' }}
        bookDemoHref="/ke/contact?type=demo&product=pharmacy"
        locale="ke"
      />,
    )
    expect(document.querySelector('iframe')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Play the Pharmacy demo video/i }))
    expect(gtag).toHaveBeenCalledWith('event', 'video_start', {
      product: 'pharmacy',
      locale: 'ke',
      surface: 'module_demo',
    })
    // The privacy boundary is intact: the facade still loads the iframe on Play.
    expect(document.querySelector('iframe')).not.toBeNull()
  })

  it('WhatsAppWidget fires whatsapp_click on the deep-link send (surface+locale, no message text)', () => {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    const open = vi.fn()
    vi.stubGlobal('open', open)
    render(<WhatsAppWidget whatsappUrl="https://wa.me/254700000000" locale="ke" />)
    fireEvent.click(screen.getByRole('button', { name: 'Chat with us on WhatsApp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send via WhatsApp' }))
    expect(gtag).toHaveBeenCalledWith('event', 'whatsapp_click', {
      surface: 'whatsapp_widget',
      locale: 'ke',
    })
    const params = gtag.mock.calls[0][2] as Record<string, string>
    expect(Object.keys(params).sort()).toEqual(['locale', 'surface'])
    expect(open).toHaveBeenCalled()
  })

  it('DemoBookingForm fires generate_lead only after a persisted success', async () => {
    const gtag = vi.fn()
    ;(window as GtagWindow).gtag = gtag
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ ok: true, reference: 'DM-ABCDEF12' }),
      })),
    )
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <DemoBookingForm initialProduct="pharmacy" locale="ke" whatsappUrl={null} />
      </NextIntlClientProvider>,
    )
    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText(/Request recorded/i)).toBeTruthy())
    expect(gtag).toHaveBeenCalledWith('event', 'generate_lead', {
      product: 'pharmacy',
      locale: 'ke',
      surface: 'demo_form',
    })
    // No PII in the payload.
    const leadCall = gtag.mock.calls.find((c) => c[1] === 'generate_lead')!
    expect(Object.keys(leadCall[2] as object).sort()).toEqual(['locale', 'product', 'surface'])
  })

  it('source: the three controls call trackConversion with a closed surface', () => {
    expect(read('src/components/marketing/module-demo-video.tsx')).toContain("trackConversion('video_start'")
    expect(read('src/components/marketing/whatsapp-widget.tsx')).toContain("trackConversion('whatsapp_click'")
    expect(read('src/components/marketing/demo-booking-form.tsx')).toContain("trackConversion('generate_lead'")
  })
})

// ── 8. CSP names only the exact Google hosts ─────────────────────────────────
describe('Task 29 · CSP allows only the exact Google endpoints', () => {
  const config = read('next.config.ts')

  it('connect-src lists the exact analytics + tag manager hosts', () => {
    const connect = config.split('\n').find((l) => l.includes('"connect-src'))!
    expect(connect).toContain('https://www.google-analytics.com')
    expect(connect).toContain('https://www.googletagmanager.com')
  })

  it('prod script-src carries googletagmanager (already asserted) and no wildcard google host', () => {
    expect(config).toContain('https://www.googletagmanager.com')
    expect(config).not.toContain('*.google-analytics.com')
    expect(config).not.toContain('*.googletagmanager.com')
    expect(config).not.toContain('*.google.com')
    expect(config).not.toContain('*.google-analytics')
  })
})

// ── 9. Layout + footer wiring ────────────────────────────────────────────────
describe('Task 29 · layout replaces @next/third-parties with the consent island', () => {
  const layout = read('src/app/[locale]/(frontend)/layout.tsx')

  it('drops @next/third-parties GoogleAnalytics entirely', () => {
    expect(layout).not.toContain('@next/third-parties')
    expect(layout).not.toContain('GoogleAnalytics')
  })

  it('resolves the id with the safe regex and renders the consent-aware island', () => {
    expect(layout).toContain('resolveGaId(process.env.NEXT_PUBLIC_GA_ID)')
    expect(layout).toContain('<SiteAnalytics gaId={gaId}')
    expect(layout).toContain('privacyHref={`/${locale}/privacy`}')
    // WhatsApp widget carries the locale for a closed conversion dimension.
    expect(layout).toContain('locale={locale}')
  })

  it('footer exposes the preferences control only when analytics is configured', () => {
    const footer = read('src/components/layout/site-footer.tsx')
    expect(footer).toContain("import { resolveGaId } from '@/lib/analytics/ga'")
    expect(footer).toContain('resolveGaId(process.env.NEXT_PUBLIC_GA_ID) !== null')
    expect(footer).toContain('analyticsEnabled ? <AnalyticsPreferences /> : null')
  })
})

// ── 10. Privacy page copy ────────────────────────────────────────────────────
describe('Task 29 · privacy page describes the opt-in analytics honestly', () => {
  const privacy = read('src/app/[locale]/(frontend)/privacy/page.tsx')

  it('documents opt-in, local storage, path-only, withdrawal, and no guarantee', () => {
    expect(privacy).toContain('Website analytics')
    expect(privacy).toContain('Accept analytics')
    expect(privacy).toContain('local storage')
    expect(privacy).toContain('Do Not Track')
    expect(privacy).toContain('Global Privacy Control')
    expect(privacy).toContain('Analytics preferences')
    expect(privacy).toContain('Google Analytics')
    // Honest about scope and no compliance claim.
    expect(privacy).toContain('not a certification')
    expect(privacy.toLowerCase()).toContain('query string')
  })
})
