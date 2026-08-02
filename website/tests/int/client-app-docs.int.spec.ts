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
  '/[locale]/docs/remote-access-setup',
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
    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)

    for (const route of EXPECTED_ROUTES) {
      const slug = route.split('/').at(-1)!
      const doc = docBySlug(slug)
      const kenyaUrl = `https://omnix.co.ke/ke/docs/${slug}`
      const entry = entries.find((candidate) => candidate.url === kenyaUrl)

      expect(doc, `${slug} exists in the docs seed`).toBeTruthy()
      expect(isPublishedDoc(doc!), `${slug} is not a scaffold`).toBe(true)
      expect(entry, `${slug} has a Kenya sitemap entry`).toBeTruthy()
      expect(Object.keys(entry?.alternates?.languages ?? {}).sort()).toEqual(['en-KE', 'x-default'])
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
    expect(mesh).toContain('WireGuard is bundled in the Windows and Android apps')
    expect(mesh).toContain("don't need a separate WireGuard app")
    expect(mesh).toContain('routes only the private Omnix subnet')
    expect(mesh).toContain('It does not make the hub reachable by itself')
    expect(mesh).toContain('Same-network use needs no router setup')
    expect(mesh).toContain('behind carrier-grade NAT, port forwarding cannot reach it')
    expect(mesh).toContain('Omnix does not currently operate a relay')
    expect(mesh).toContain('Android shows its system VPN permission dialog')
    expect(mesh).toContain('Accept it once')
    expect(mesh).toContain('persistent **Omnix Private Mesh** notification')
    expect(mesh).toContain('tap **Connect Private Mesh**')

    const android = docBySlug('android-app')!.body
    expect(android).toContain('system VPN permission prompt once')
    expect(android).toContain('persistent **Omnix Private Mesh** notification')
    expect(android).toContain('**Connect Private Mesh** control')

    const browser = docBySlug('browser-companion')!.body
    expect(browser).toContain('read-only')
    expect(browser).toContain('LAN-only')
    expect(browser).toContain('same branch Wi-Fi')

    const desktop = docBySlug('windows-desktop-hub')!.body
    expect(desktop).toContain('KRA eTIMS and SHA')
    expect(desktop).toContain('does not claim direct URA, TRA, or RRA fiscal integration')
  })

  it('documents endpoint publication and the full direct remote-access setup', () => {
    const remote = docBySlug('remote-access-setup')!.body

    for (const phrase of [
      'Same-network use needs none of this',
      '**Settings**, then **Network**, then **Omnix Private Mesh**',
      'publish the endpoint',
      'Windows UAC prompt',
      'changes the WireGuard listener and restarts the Private Mesh helper',
      'Address Reservation',
      'DHCP Reservation',
      'Static Lease',
      'Port Forwarding',
      'Virtual Server',
      'Windows Security',
      'Firewall & network protection',
      'Inbound Rules',
      'No TCP forward is needed',
      'Dynamic DNS',
      'DDNS',
      'Safaricom',
      'Zuku',
      'TP-Link',
      'MikroTik RouterOS',
      'Switch off Wi-Fi on the phone so it is using mobile data',
      'no WireGuard account to create',
      'no separate WireGuard app to install',
    ]) {
      expect(remote).toContain(phrase)
    }

    expect(remote).toContain('Compare the two addresses exactly')
    expect(remote).toContain('If they differ, the connection is behind carrier-grade NAT')
    expect(remote).toContain('Port forwarding cannot work on that line')
    expect(remote).toContain('Omnix does not have a relay today')
    expect(remote).toContain('same number for the router\'s external port, internal port, and Windows Firewall rule')
    expect(remote).toContain('Only the private Omnix subnet goes through the tunnel')
    expect(remote).toContain('persistent **Omnix Private Mesh** notification')
  })

  it('explains every Private Mesh and reachability state named in the apps', () => {
    const remote = docBySlug('remote-access-setup')!.body
    for (const state of [
      'Mesh not configured',
      'Connecting',
      'Connected',
      'Hub unreachable',
      'VPN permission denied',
      'Mesh unavailable',
      'Not observed',
      'Unknown',
    ]) {
      expect(remote).toContain(`**${state}**`)
    }

    expect(remote).toContain('**Observed public address** stays **Not observed**')
    expect(remote).toContain('**UDP reachability** and **Connection type** stay **Unknown**')
    expect(remote).toContain('Do not read **Unknown** as success')
  })
})
