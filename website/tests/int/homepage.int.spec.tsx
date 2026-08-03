import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HOMEPAGE_PRODUCTS, Homepage } from '@/components/landing/homepage'

afterEach(cleanup)

describe('Task 9 homepage acquisition', () => {
  it('offers exactly the five public products in buyer language', () => {
    render(<Homepage locale="ke" />)

    expect(HOMEPAGE_PRODUCTS.map((product) => product.name)).toEqual([
      'Pharmacy',
      'Retail',
      'Hospitality',
      'Hardware & Equipment',
      'Salon & Spa',
    ])
    expect(document.querySelectorAll('[data-home-product]')).toHaveLength(5)

    const acquisition = document.querySelector('[data-homepage-acquisition]')
    expect(acquisition?.textContent).toMatch(/POS/i)
    expect(acquisition?.textContent).toMatch(/inventory/i)
    expect(acquisition?.textContent).toMatch(/pharmacy software/i)
    expect(acquisition?.textContent).toMatch(/restaurant POS/i)
    expect(acquisition?.textContent).toMatch(/appointments/i)
    expect(acquisition?.textContent).not.toMatch(/\bERP\b/i)
    expect(acquisition?.textContent).not.toMatch(/\bAI\b/i)
    expect(acquisition?.textContent).not.toMatch(/Omnix Pro/i)
    expect(acquisition?.textContent).not.toMatch(/\btrial\b/i)
  })

  it('uses locale-aware demo and product links', () => {
    render(<Homepage locale="ug" />)

    const demoLinks = screen.getAllByRole('link', { name: 'Book a demo' })
    expect(demoLinks).toHaveLength(2)
    for (const link of demoLinks) {
      expect(link.getAttribute('href')).toBe('/ug/contact?type=demo')
    }
    expect(screen.getByRole('link', { name: 'Explore Pharmacy' }).getAttribute('href')).toBe('/ug/pharmacy')
    expect(screen.getByRole('link', { name: 'Explore Salon & Spa' }).getAttribute('href')).toBe('/ug/salon')
  })

  it('shows WhatsApp only when configured', () => {
    const { rerender } = render(<Homepage locale="ke" />)
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()

    rerender(<Homepage locale="ke" whatsappUrl="https://wa.me/254700000000" />)
    expect(screen.getByRole('link', { name: 'Ask on WhatsApp' }).getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/254700000000\?text=/,
    )
  })

  it('renders explicit empty media states and approved media when supplied', () => {
    const { rerender } = render(<Homepage locale="ke" />)
    expect(document.querySelector('[data-media-state="empty"]')).not.toBeNull()
    expect(screen.getByText('No stock image substituted')).not.toBeNull()
    expect(screen.getAllByText('Product view available in the guided demo.')).toHaveLength(5)

    rerender(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Omnix POS sale screen' }}
        productMedia={{ pharmacy: { url: 'https://media.omnix.co.ke/pharmacy.webp', alt: 'Pharmacy dispensing screen' } }}
      />,
    )
    expect(screen.getByAltText('Omnix POS sale screen')).not.toBeNull()
    expect(screen.getByAltText('Pharmacy dispensing screen')).not.toBeNull()

    rerender(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Fallback POS sale screen' }}
        heroVideo={{
          url: 'https://media.omnix.co.ke/hero.webm',
          alt: 'Omnix POS and inventory in use',
          mimeType: 'video/webm',
        }}
        heroVideoPoster={{
          url: 'https://media.omnix.co.ke/hero-poster.webp',
          alt: 'Poster for the Omnix product video',
        }}
      />,
    )
    const video = screen.getByLabelText('Omnix POS and inventory in use')
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('poster')).toBe('https://media.omnix.co.ke/hero-poster.webp')
    expect(video.querySelector('source')?.getAttribute('type')).toBe('video/webm')
    expect(screen.queryByAltText('Fallback POS sale screen')).toBeNull()

    rerender(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Approved POS sale screen' }}
        heroVideo={{
          url: 'https://media.omnix.co.ke/unpaired-hero.webm',
          alt: 'Unpaired product video',
          mimeType: 'video/webm',
        }}
      />,
    )
    expect(screen.queryByLabelText('Unpaired product video')).toBeNull()
    expect(screen.getByAltText('Approved POS sale screen')).not.toBeNull()
  })

  it('makes every showcase still openable full size', () => {
    render(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Omnix dashboard' }}
        productMedia={{
          pharmacy: { url: 'https://media.omnix.co.ke/pharmacy.webp', alt: 'Pharmacy screen' },
          retail: { url: 'https://media.omnix.co.ke/retail.webp', alt: 'Retail screen' },
        }}
      />,
    )

    const triggers = screen.getAllByRole('button', { name: /^Open full-size view:/ })
    expect(triggers).toHaveLength(3)
    expect(triggers.map((t) => t.getAttribute('aria-label'))).toContain(
      'Open full-size view: Omnix dashboard',
    )
  })

  it('opens the full-size view on click and exposes it as a modal', () => {
    render(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Omnix dashboard' }}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open full-size view: Omnix dashboard' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Full-size view: Omnix dashboard')).toBeTruthy()
    // The dialog shows the same approved asset, not a substitute.
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe(
      'https://media.omnix.co.ke/hero.webp',
    )
  })

  it('opens from the keyboard and restores focus to the trigger on Escape', async () => {
    render(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Omnix dashboard' }}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Open full-size view: Omnix dashboard' })
    act(() => trigger.focus())
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // Radix returns focus on a microtask after unmount, so wait rather than assume.
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('keeps a closable control inside the full-size view', () => {
    render(
      <Homepage
        locale="ke"
        heroMedia={{ url: 'https://media.omnix.co.ke/hero.webp', alt: 'Omnix dashboard' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open full-size view: Omnix dashboard' }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('never makes an empty media slot look clickable', () => {
    render(<Homepage locale="ke" />)

    expect(screen.queryAllByRole('button', { name: /^Open full-size view:/ })).toHaveLength(0)
    expect(screen.getByText('No stock image substituted')).toBeTruthy()
  })
})
