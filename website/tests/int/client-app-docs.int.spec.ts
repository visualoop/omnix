import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import sitemap from '@/app/sitemap'
import { DOC_CONTENT_ROUTES } from '@/config/route-inventory'
import { docBySlug } from '@/lib/docs-seed'
import { isPublishedDoc } from '@/lib/docs-visibility'

const downloads = readFileSync(
  join(process.cwd(), 'src/app/[locale]/(frontend)/downloads/page.tsx'),
  'utf8',
)

const EXPECTED_ROUTES = [
  '/[locale]/docs/windows-desktop-hub',
  '/[locale]/docs/android-app',
  '/[locale]/docs/browser-companion',
  '/[locale]/docs/private-mesh',
] as const

describe('application downloads and customer guides', () => {
  it('covers the three clients with requirements, connection steps, and guide links', () => {
    for (const phrase of [
      'Windows desktop hub',
      'Android app',
      'Browser companion',
      'Requirements',
      'Install or connect',
      "Google Play distribution is not live",
      'iOS is not available',
      'read-only',
      'branch LAN',
    ]) {
      expect(downloads).toContain(phrase)
    }

    for (const slug of ['windows-desktop-hub', 'android-app', 'browser-companion']) {
      expect(downloads).toContain(`docSlug: '${slug}'`)
    }
  })

  it('registers every client guide as written content and emits its Kenya canonical route', () => {
    expect(DOC_CONTENT_ROUTES).toEqual(EXPECTED_ROUTES)
    const urls = sitemap().map((entry) => entry.url)

    for (const route of EXPECTED_ROUTES) {
      const slug = route.split('/').at(-1)!
      const doc = docBySlug(slug)
      expect(doc, `${slug} exists in the docs seed`).toBeTruthy()
      expect(isPublishedDoc(doc!), `${slug} is not a scaffold`).toBe(true)
      expect(urls).toContain(`https://omnix.co.ke/ke/docs/${slug}`)
      expect(urls).not.toContain(`https://omnix.co.ke/ug/docs/${slug}`)
      expect(urls).not.toContain(`https://omnix.co.ke/tz/docs/${slug}`)
      expect(urls).not.toContain(`https://omnix.co.ke/rw/docs/${slug}`)
    }
  })

  it('documents Android enrollment, device controls, POS, branches, offline work, and PDF sharing', () => {
    const body = docBySlug('android-app')!.body
    for (const phrase of [
      'signed APK',
      'First-run enrolment',
      'Profile and device controls',
      'Sell from mobile POS',
      'All Branches',
      'Work offline',
      'Reports and PDF sharing',
      'Share PDF',
      'Install an update from inside Omnix',
      'pinned Omnix release certificate',
      'CameraX capture view',
      'Manual item search remains available',
    ]) {
      expect(body).toContain(phrase)
    }
  })

  it('states the mesh and browser boundaries without inventing regional fiscal integrations', () => {
    const mesh = docBySlug('private-mesh')!.body
    expect(mesh).toContain("WireGuard is bundled inside Omnix")
    expect(mesh).toContain("don't need a separate WireGuard app")
    expect(mesh).toContain('routes only the private Omnix subnet')
    expect(mesh).toContain('Android shows its system VPN permission dialog')

    const browser = docBySlug('browser-companion')!.body
    expect(browser).toContain('read-only')
    expect(browser).toContain('LAN-only')
    expect(browser).toContain('same branch Wi-Fi')

    const desktop = docBySlug('windows-desktop-hub')!.body
    expect(desktop).toContain('KRA eTIMS and SHA')
    expect(desktop).toContain('does not claim direct URA, TRA, or RRA fiscal integration')
  })
})
