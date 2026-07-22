import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  BoundaryLedger,
  TrustChannelGrid,
  TrustHero,
  TrustTeamGrid,
} from '@/components/marketing/trust-pages'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const ROUTE_DIR = 'src/app/[locale]/(frontend)'
const trustPages = read('src/components/marketing/trust-pages.tsx')
const trustCss = read('src/components/marketing/trust-pages.module.css')

const PAGES = {
  about: read(`${ROUTE_DIR}/about/page.tsx`),
  team: read(`${ROUTE_DIR}/team/page.tsx`),
  partners: read(`${ROUTE_DIR}/partners/page.tsx`),
  support: read(`${ROUTE_DIR}/support/page.tsx`),
  mpesa: read(`${ROUTE_DIR}/mpesa/page.tsx`),
  etims: read(`${ROUTE_DIR}/etims/page.tsx`),
  sha: read(`${ROUTE_DIR}/sha/page.tsx`),
} as const

const ALL_PAGES = Object.entries(PAGES)

afterEach(cleanup)

describe('Task 15 trust routes — localization and conversion', () => {
  it('localizes canonical, hreflang, and demo CTAs for every trust route', () => {
    for (const [route, source] of ALL_PAGES) {
      expect(source, `${route} canonical`).toContain(`const canonical = \`\${SITE_URL}/\${locale}/${route}\``)
      expect(source, `${route} hreflang`).toContain(`buildAlternatesLanguages('/${route}')`)
      expect(source, `${route} imports trust primitives`).toContain(
        "from '@/components/marketing/trust-pages'",
      )
      expect(source, `${route} passes locale to primitives`).toContain('locale={locale}')
      expect(source, `${route} wires configured WhatsApp`).toContain('whatsappUrl={settings.whatsappUrl}')
    }
    // The single demo primary is built inside the shared primitive.
    expect(trustPages).toContain('/${locale}/contact?type=demo')
    expect(trustPages).toContain("'Book a demo'")
  })

  it('never ships trials, public sign-up, or public installer CTAs on trust routes', () => {
    for (const [route, source] of ALL_PAGES) {
      expect(source, `${route} no trial`).not.toMatch(/free trial|start trial/i)
      expect(source, `${route} no signup`).not.toContain('/signup')
      expect(source, `${route} no buy variant`).not.toMatch(/\/buy\?variant/)
      expect(source, `${route} no no-card`).not.toMatch(/no card/i)
    }
  })

  it('does not fabricate response times or throughput on any trust route', () => {
    for (const [route, source] of ALL_PAGES) {
      expect(source, `${route} timed unit`).not.toMatch(/\b\d+\s*(second|minute|hour)s?\b/i)
      expect(source, `${route} within-window`).not.toMatch(/within\s+(a|one|two|three|four|\d)/i)
      expect(source, `${route} response-time`).not.toMatch(/usually respond|response time|business days/i)
    }
    // The partners form success message no longer promises a turnaround.
    const form = read('src/components/marketing/partners-form.tsx')
    expect(form).not.toMatch(/within two business days|often the same day/i)
  })
})

describe('Task 15 trust routes — honest boundaries', () => {
  it('separates local recording from the connected M-Pesa request', () => {
    expect(PAGES.mpesa).toContain('<BoundaryLedger')
    expect(PAGES.mpesa).toContain('The sale is recorded locally.')
    expect(PAGES.mpesa).toContain('Safaricom Daraja')
    expect(PAGES.mpesa).toMatch(/internet access at the moment of payment/i)
    expect(PAGES.mpesa).toMatch(/Omnix takes no margin/i)
    expect(PAGES.mpesa).toMatch(/statutory responsibility/i)
  })

  it('separates local invoices from connected KRA eTIMS signing', () => {
    expect(PAGES.etims).toContain('<BoundaryLedger')
    expect(PAGES.etims).toContain('Invoices are created and stored locally.')
    expect(PAGES.etims).toMatch(/Signing and submission cross to KRA/i)
    expect(PAGES.etims).toMatch(/queued and retried/i)
    expect(PAGES.etims).toMatch(/valid KRA PIN/i)
    expect(PAGES.etims).toMatch(/filing of returns remain your obligations/i)
  })

  it('separates local claims from connected SHA verification and decisions', () => {
    expect(PAGES.sha).toContain('<BoundaryLedger')
    expect(PAGES.sha).toMatch(/Patient records and claim drafts are local/i)
    expect(PAGES.sha).toMatch(/accredited provider account/i)
    expect(PAGES.sha).toMatch(/determined by SHA under its rules/i)
    expect(PAGES.sha).toMatch(/copay/i)
    // SHA decides cover/payment, not Omnix.
    expect(PAGES.sha).toMatch(/not by Omnix/i)
  })
})

describe('Task 15 trust routes — governed people and media', () => {
  it('keeps the team page behind the approved-media resolver and rejects raw URLs', () => {
    expect(PAGES.team).toContain('getApprovedTeamMemberPhoto(member.mediaId)')
    expect(PAGES.team).not.toMatch(/photoUrl/)
    expect(PAGES.team).not.toContain('teamMembers.photoUrl')
    // The DB-backed active/sortOrder query is preserved.
    expect(PAGES.team).toContain('eq(teamMembers.active, true)')
    expect(PAGES.team).toContain('asc(teamMembers.sortOrder)')
    // The grid only ever paints the approved resolver URL.
    expect(trustPages).toContain('src={member.photo.url}')
    expect(trustPages).toContain('styles.emptyState')
  })

  it('uses config-backed settings, not fabricated offices or named people, on About/Partners', () => {
    for (const source of [PAGES.about, PAGES.partners, PAGES.support]) {
      expect(source).toContain('getSiteSettings')
    }
    // About must not invent a signed founder identity or an office address.
    expect(PAGES.about).not.toMatch(/—\s*Justin|Founder · Nairobi|our office/i)
  })
})

describe('Task 15 trust routes — shared Working Counter aesthetic', () => {
  it('reuses the shared trust primitives instead of the old page-hero aesthetic', () => {
    for (const [route, source] of ALL_PAGES) {
      expect(source, `${route} no legacy hero`).not.toContain('page-hero')
      expect(source, `${route} no legacy closing`).not.toContain('ClosingCtaSection')
      expect(source, `${route} uses TrustHero`).toContain('<TrustHero')
      expect(source, `${route} uses TrustClosing`).toContain('<TrustClosing')
    }
  })

  it('keeps the shared trust CSS light-first, token-backed, responsive, and gradient-free', () => {
    expect(trustCss).toContain('Working Counter')
    expect(trustCss).toContain('var(--color-bg)')
    expect(trustCss).toMatch(/overflow-x:\s*clip/)
    expect(trustCss).toMatch(/@media\s*\(max-width:\s*40rem\)/)
    expect(trustCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(trustCss).toMatch(/minmax\(0,\s*1fr\)/)
    expect(trustCss).not.toMatch(/gradient/)
  })
})

describe('Task 15 trust primitives — rendered behaviour', () => {
  const heroProps = {
    kicker: 'M-Pesa · Kenya',
    title: 'M-Pesa at the counter,',
    accent: 'recorded either way.',
    lede: 'The sale is local; the request is connected.',
    factsTitle: 'M-Pesa at a glance',
    facts: [{ label: 'Sale record', value: 'Stored locally' }],
    whatsappMessage: 'Hi Omnix',
  }

  it('renders a single demo primary and a configured WhatsApp secondary', () => {
    render(<TrustHero {...heroProps} locale="ke" whatsappUrl="https://wa.me/254700000000" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('recorded either way.')
    expect(screen.getAllByRole('link', { name: 'Book a demo' })[0].getAttribute('href')).toBe(
      '/ke/contact?type=demo',
    )
    expect(screen.getByRole('link', { name: 'Ask on WhatsApp' }).getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/254700000000\?text=/,
    )
  })

  it('drops the WhatsApp secondary when the line is not configured', () => {
    render(<TrustHero {...heroProps} locale="ng" whatsappUrl={null} />)
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Book a demo' })[0].getAttribute('href')).toBe(
      '/ng/contact?type=demo',
    )
  })

  it('renders the responsibility ledger rows', () => {
    render(
      <BoundaryLedger
        title="What is local, what is connected."
        intro="Keep the responsibilities separate."
        items={[
          { owner: 'On the device', title: 'The sale is recorded locally.', body: 'Local body.' },
          { owner: 'Needs a connection', title: 'The request travels online.', body: 'Online body.' },
        ]}
      />,
    )
    expect(screen.getByText('On the device')).toBeTruthy()
    expect(screen.getByText('The sale is recorded locally.')).toBeTruthy()
    expect(screen.getByText('Needs a connection')).toBeTruthy()
  })

  it('shows only approved photos and falls back to initials, never invented people', () => {
    const { rerender } = render(<TrustTeamGrid members={[]} emptyMessage="Directory is empty." />)
    expect(screen.getByText('Directory is empty.')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()

    rerender(
      <TrustTeamGrid
        emptyMessage="Directory is empty."
        members={[
          {
            id: '1',
            name: 'Approved Person',
            role: 'Engineer',
            photo: { url: 'https://media.omnix.co.ke/team/1.png', alt: 'Approved Person' },
          },
          { id: '2', name: 'Jane Doe', role: 'Support', photo: null },
        ]}
      />,
    )
    const img = document.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://media.omnix.co.ke/team/1.png')
    expect(screen.getByText('Approved Person')).toBeTruthy()
    // No approved photo → initials fallback, no second image.
    expect(document.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByText('JD')).toBeTruthy()
  })

  it('renders internal channels as links and external channels as new-tab anchors', () => {
    render(
      <TrustChannelGrid
        channels={[
          {
            title: 'WhatsApp',
            body: 'Configured line.',
            href: 'https://wa.me/254700000000?text=hi',
            linkLabel: 'Open WhatsApp',
            external: true,
          },
          { title: 'Documentation', body: 'Guides.', href: '/ke/docs', linkLabel: 'Browse the docs' },
        ]}
      />,
    )
    const whatsapp = screen.getByRole('link', { name: 'Open WhatsApp' })
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/254700000000?text=hi')
    expect(whatsapp.getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('link', { name: 'Browse the docs' }).getAttribute('href')).toBe('/ke/docs')
  })
})
