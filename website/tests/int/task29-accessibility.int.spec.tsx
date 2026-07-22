import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

/*
 * Task 29 — bucket B accessibility: landmarks, navigation, status, form and
 * media semantics. Source + render coverage that locks the invariants without
 * standing up a server or a database:
 *   1. Exactly one <main> landmark per rendered public route — the (frontend)
 *      layout owns it, and every page/component beneath it uses a non-main root.
 *   2. Auth + checkout layouts expose a visible-on-focus skip link to a real
 *      #main-content, and the app shells keep their own skip target.
 *   3. The SiteHeader dropdown is disclosure navigation (button + list of
 *      normal links), not an ARIA application menu; Escape closes it and
 *      returns focus to the trigger; the current page is aria-current.
 *   4. The static StatusDot indicator is not a live region but still exposes an
 *      accessible name.
 *   5. Media stays keyboard-safe: the module demo is a real <button> facade
 *      with a lazy, titled iframe only after an explicit Play; the decorative
 *      video is removed from the tab order.
 */

// next/navigation is mocked so the client SiteHeader renders under jsdom.
let mockPathname = '/ke/pharmacy'
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
// Isolate the header's navigation behaviour from unrelated chrome.
vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => null,
}))
vi.mock('@/components/theme/theme-toggle', () => ({
  ThemeToggle: () => null,
}))

import { SiteHeader } from '@/components/layout/site-header'
import { StatusDot } from '@/components/admin/status-dot'
import { ModuleDemoVideo } from '@/components/marketing/module-demo-video'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const FRONTEND = join('src', 'app', '[locale]', '(frontend)')
const MESSAGES = { nav: { signIn: 'Sign in' } }
const VALID_ID = 'dQw4w9WgXcQ'

function renderHeader(locale = 'ke') {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <SiteHeader locale={locale} />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  mockPathname = '/ke/pharmacy'
})

// ── 1. One-main landmark contract ────────────────────────────────────────────
describe('Task 29 · exactly one main landmark per public route', () => {
  it('the (frontend) layout owns the single #main-content landmark', () => {
    const layout = read(join(FRONTEND, 'layout.tsx'))
    expect(layout).toContain('<main id="main-content"')
    // Only one <main> opening tag in the layout.
    expect(layout.match(/<main[\s>]/g) ?? []).toHaveLength(1)
  })

  it('no localized page or shared marketing component rendered beneath it declares its own <main>', () => {
    const beneathMain = [
      // (frontend) pages
      join(FRONTEND, 'docs', 'page.tsx'),
      join(FRONTEND, 'docs', '[slug]', 'page.tsx'),
      join(FRONTEND, 'changelog', 'page.tsx'),
      join(FRONTEND, 'roadmap', 'page.tsx'),
      join(FRONTEND, 'migration', 'page.tsx'),
      join(FRONTEND, 'downloads', 'page.tsx'),
      join(FRONTEND, 'blog', 'page.tsx'),
      join(FRONTEND, 'blog', '[slug]', 'page.tsx'),
      join(FRONTEND, 'contact', 'page.tsx'),
      join(FRONTEND, 'security', 'page.tsx'),
      // shared marketing components used by those routes
      'src/components/marketing/locations-index.tsx',
      'src/components/marketing/guides-index.tsx',
      'src/components/marketing/buyer-guide.tsx',
      'src/components/marketing/location-hub.tsx',
      'src/components/marketing/legal-layout.tsx',
      'src/components/marketing/trust-pages.tsx',
    ]
    for (const rel of beneathMain) {
      const src = read(rel)
      // A JSX <main> opening always carries a space (attributes) in these files;
      // trust-pages only mentions "<main>" in an explanatory comment, which the
      // space-anchored check correctly ignores.
      expect(src.includes('<main '), `${rel} must not open a nested <main>`).toBe(false)
      expect(src.includes('</main>'), `${rel} must not close a nested <main>`).toBe(false)
    }
  })

  it('doc + blog detail pages keep semantic article structure instead of main', () => {
    expect(read(join(FRONTEND, 'docs', '[slug]', 'page.tsx'))).toContain('<article')
    expect(read(join(FRONTEND, 'blog', '[slug]', 'page.tsx'))).toContain('<article')
    expect(read('src/components/marketing/buyer-guide.tsx')).toContain('<article')
    expect(read('src/components/marketing/location-hub.tsx')).toContain('<article')
  })

  it('the app shells + private routes keep a single usable main target', () => {
    // Dashboard/admin main is rendered once by AppPage; the shells skip-link to it.
    expect(read('src/components/layout/layout-primitives.tsx')).toContain("<main")
    const dashShell = read('src/components/dashboard/dashboard-shell.tsx')
    expect(dashShell).toContain('href="#dashboard-main"')
    expect(dashShell).toContain('id="dashboard-main"')
    const adminShell = read('src/components/admin/admin-shell.tsx')
    expect(adminShell).toContain('href="#admin-main"')
    expect(adminShell).toContain('id="admin-main"')
    // Onboarding, not-found and the global error boundary each own exactly one main.
    for (const rel of [
      'src/app/onboarding/layout.tsx',
      'src/app/not-found.tsx',
      'src/app/global-error.tsx',
    ]) {
      expect((read(rel).match(/<main[\s>]/g) ?? []).length, `${rel} should have one main`).toBe(1)
    }
  })
})

// ── 2. Auth + checkout skip links ────────────────────────────────────────────
describe('Task 29 · auth + checkout skip links target a real #main-content', () => {
  it('auth layout: visible-on-focus skip link + main#main-content', () => {
    const auth = read('src/app/(auth)/layout.tsx')
    expect(auth).toContain('href="#main-content"')
    expect(auth).toContain('Skip to main content')
    expect(auth).toContain('focus:not-sr-only')
    expect(auth).toContain('<main id="main-content"')
  })

  it('checkout layout: skip link + main#main-content added without touching the counter chrome', () => {
    const checkout = read('src/app/(checkout)/layout.tsx')
    expect(checkout).toContain('href="#main-content"')
    expect(checkout).toContain('Skip to main content')
    expect(checkout).toContain('focus:not-sr-only')
    expect(checkout).toContain('<main id="main-content"')
    // The privacy/secure-checkout marker is untouched.
    expect(checkout).toContain('Secure checkout')
  })
})

// ── 3. Disclosure navigation semantics + Escape focus return ─────────────────
describe('Task 29 · SiteHeader is disclosure navigation, not an application menu', () => {
  it('the source drops menu/menuitem roles and uses aria-expanded + aria-controls', () => {
    const header = read('src/components/layout/site-header.tsx')
    expect(header).not.toContain('role="menu"')
    expect(header).not.toContain('role="menuitem"')
    expect(header).not.toContain('aria-haspopup="menu"')
    expect(header).toContain('aria-expanded={isOpen}')
    expect(header).toContain('aria-controls={menuId}')
    // Escape returns focus to the trigger.
    expect(header).toContain("event.key === 'Escape'")
    expect(header).toContain('trigger?.focus()')
    // Current-page semantics preserved on both top-level and child links.
    expect(header).toContain("aria-current={active ? 'page' : undefined}")
    expect(header).toContain("aria-current={childIsActive ? 'page' : undefined}")
  })

  it('renders a disclosure button controlling a list of normal links', () => {
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Products' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-haspopup')).toBeNull()
    // No application-menu roles anywhere.
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.querySelector('[role="menuitem"]')).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const panelId = trigger.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    const panel = document.getElementById(panelId!)
    expect(panel).not.toBeNull()
    expect(panel!.tagName).toBe('UL')
    const links = Array.from(panel!.querySelectorAll('a'))
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link.getAttribute('role')).toBeNull()
  })

  it('marks the current page inside the dropdown with aria-current', () => {
    mockPathname = '/ke/pharmacy'
    renderHeader('ke')
    fireEvent.click(screen.getByRole('button', { name: 'Products' }))
    const current = screen.getByRole('link', { name: /Pharmacy/i })
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('closes on Escape and returns focus to the trigger button', () => {
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Products' })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('mobile sheet exposes an accessible dialog with a labelled close control', () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Close menu' })).toBeTruthy()
  })
})

// ── 4. Static status semantics ───────────────────────────────────────────────
describe('Task 29 · static status indicators are not live regions', () => {
  it('StatusDot source uses role="img", never a live role="status"', () => {
    const dot = read('src/components/admin/status-dot.tsx')
    expect(dot).toContain('role="img"')
    expect(dot).not.toContain('role="status"')
  })

  it('renders as an image with an accessible name and no status live region', () => {
    render(<StatusDot tone="live" pulse label="Online" />)
    expect(screen.getByRole('img', { name: 'Online' })).toBeTruthy()
    expect(document.querySelector('[role="status"]')).toBeNull()
  })

  it('the customer status vocabulary always pairs colour with a text label', () => {
    const utils = read('src/components/dashboard/status-utils.tsx')
    // Every registry entry carries a human label alongside its token class.
    expect(utils).toContain("label: 'Active'")
    expect(utils).toContain("label: 'Paid'")
    expect(utils).toContain('meta.label')
    // The pill is a plain span (no live region) — colour is reinforcement only.
    expect(utils).not.toContain('role="status"')
  })
})

// ── 5. Media keyboard contract ───────────────────────────────────────────────
describe('Task 29 · media stays keyboard-safe', () => {
  it('module demo is a button facade; the titled, lazy iframe loads only after Play', () => {
    render(
      <ModuleDemoVideo
        product="pharmacy"
        productLabel="Pharmacy"
        content={{ videoId: VALID_ID, title: 'Pharmacy walkthrough', summary: 'Dispense, pay, review.' }}
        bookDemoHref="/ke/contact?type=demo&product=pharmacy"
      />,
    )
    // No iframe (and no click surface other than a real button) before Play.
    expect(document.querySelector('iframe')).toBeNull()
    const play = screen.getByRole('button', { name: /Play the Pharmacy demo video/i })
    // Text summary is a visible, always-present alternative.
    expect(screen.getByText('Dispense, pay, review.')).not.toBeNull()

    fireEvent.click(play)
    const iframe = document.querySelector('iframe')!
    expect(iframe).not.toBeNull()
    expect(iframe.getAttribute('title')).toBe('Pharmacy walkthrough')
    expect(iframe.getAttribute('loading')).toBe('lazy')
    expect(iframe.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('decorative hero video is removed from the tab order and never carries autoplay', () => {
    const src = read('src/components/marketing/decorative-video.tsx')
    // Decorative usage is aria-hidden + tabIndex -1; playback is gated on motion.
    expect(src).toContain('tabIndex={decorative ? -1 : undefined}')
    expect(src).toContain('aria-hidden={decorative ? true : undefined}')
    expect(src).not.toContain('autoPlay')
    expect(src).toContain('usePrefersReducedMotion')
  })
})
