import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ModulesWebsite } from '@/components/marketing/modules-website'
import { PricingWebsite } from '@/components/marketing/pricing-website'
import { pricing } from '@/config/pricing'

const ROOT = process.cwd()
const pricingRoute = readFileSync(join(ROOT, 'src/app/[locale]/(frontend)/pricing/page.tsx'), 'utf8')
const modulesRoute = readFileSync(join(ROOT, 'src/app/[locale]/(frontend)/modules/page.tsx'), 'utf8')
const pricingComponent = readFileSync(join(ROOT, 'src/components/marketing/pricing-website.tsx'), 'utf8')
const modulesComponent = readFileSync(join(ROOT, 'src/components/marketing/modules-website.tsx'), 'utf8')
const routeStyles = readFileSync(join(ROOT, 'src/components/marketing/acquisition-routes.module.css'), 'utf8')

const PUBLIC_PRODUCT_NAMES = [
  'Pharmacy',
  'Retail',
  'Hospitality',
  'Hardware & Equipment',
  'Salon & Spa',
] as const

function renderPricing(whatsappUrl: string | null = null) {
  return render(
    <PricingWebsite
      locale="ke"
      currency="KES"
      oneTimeFee={pricing.starter.oneTimeFee.KES}
      maintenanceYearly={pricing.starter.maintenanceYearly.KES}
      cloudBackupMonthly={pricing.cloudBackupMonthly.KES}
      extraBranchOneTime={pricing.extraBranchOneTime.KES}
      extraMachineOneTime={pricing.extraMachineOneTime.KES}
      whatsappUrl={whatsappUrl}
    />,
  )
}

afterEach(cleanup)

describe('Task 14 pricing acquisition route', () => {
  it('renders the configured one-time starter licence without fabricated tiers', () => {
    const { container } = renderPricing()
    const page = container.querySelector('[data-pricing-acquisition]')
    const copy = page?.textContent ?? ''

    expect(screen.getByLabelText('Starter licence price').textContent).toContain('KES')
    expect(screen.getByLabelText('Starter licence price').textContent).toContain('30,000')
    expect(copy).toMatch(/one-time/i)
    expect(copy).toMatch(/perpetual/i)
    expect(copy).toMatch(/compliance updates are not required to keep it working/i)
    expect(copy).toMatch(/skipping the optional update plan does not deactivate the licence/i)
    expect(copy).not.toMatch(/\btrial\b/i)
    expect(copy).not.toMatch(/\bPro\b/)
    expect(copy).not.toMatch(/\bAI\b/)
    expect(container.querySelectorAll('[data-pricing-product]')).toHaveLength(5)
  })

  it('makes the localized demo primary and configured WhatsApp secondary', () => {
    const { rerender } = renderPricing()
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()
    for (const link of screen.getAllByRole('link', { name: 'Book a demo' })) {
      expect(link.getAttribute('href')).toBe('/ke/contact?type=demo')
    }

    rerender(
      <PricingWebsite
        locale="ke"
        currency="KES"
        oneTimeFee={pricing.starter.oneTimeFee.KES}
        maintenanceYearly={pricing.starter.maintenanceYearly.KES}
        cloudBackupMonthly={pricing.cloudBackupMonthly.KES}
        extraBranchOneTime={pricing.extraBranchOneTime.KES}
        extraMachineOneTime={pricing.extraMachineOneTime.KES}
        whatsappUrl="https://wa.me/254700000000"
      />,
    )
    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    }
  })

  it('reads every public price from server config and uses locale-free hreflang input', () => {
    expect(pricingRoute).toContain('pricing.starter.oneTimeFee[currency]')
    expect(pricingRoute).toContain('pricing.starter.maintenanceYearly[currency]')
    expect(pricingRoute).toContain('pricing.cloudBackupMonthly[currency]')
    expect(pricingRoute).toContain('pricing.extraBranchOneTime[currency]')
    expect(pricingRoute).toContain('pricing.extraMachineOneTime[currency]')
    expect(pricingRoute).toContain("buildAlternatesLanguages('/pricing')")
  })
})

describe('Task 14 modules acquisition route', () => {
  it('presents exactly the five approved public products', () => {
    const { container } = render(<ModulesWebsite locale="ke" />)
    const products = Array.from(container.querySelectorAll('[data-public-product]'))
    const names = products.map((product) => product.querySelector('h2')?.textContent)
    const copy = container.querySelector('[data-modules-acquisition]')?.textContent ?? ''

    expect(products).toHaveLength(5)
    expect(names).toEqual(PUBLIC_PRODUCT_NAMES)
    expect(copy).not.toMatch(/\btrial\b/i)
    expect(copy).not.toMatch(/\bPro\b/)
    expect(copy).not.toMatch(/\bAI\b/)
  })

  it('localizes product and demo links and keeps WhatsApp conditional', () => {
    const { rerender } = render(<ModulesWebsite locale="ng" />)
    expect(screen.getByRole('link', { name: 'View Pharmacy' }).getAttribute('href')).toBe('/ng/pharmacy')
    expect(screen.getByRole('link', { name: 'View Salon & Spa' }).getAttribute('href')).toBe('/ng/salon')
    for (const link of screen.getAllByRole('link', { name: 'Book a demo' })) {
      expect(link.getAttribute('href')).toBe('/ng/contact?type=demo')
    }
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()

    rerender(<ModulesWebsite locale="ng" whatsappUrl="https://wa.me/254700000000" />)
    expect(screen.getAllByRole('link', { name: 'Ask on WhatsApp' })).toHaveLength(2)
  })

  it('uses locale-free hreflang input and does not source the public list from legacy module seed data', () => {
    expect(modulesRoute).toContain("buildAlternatesLanguages('/modules')")
    expect(modulesRoute).not.toContain('MODULES_SEED')
  })

  it('keeps both acquisition surfaces server-rendered and mobile-first', () => {
    expect(pricingComponent).not.toContain("'use client'")
    expect(modulesComponent).not.toContain("'use client'")
    expect(routeStyles).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(routeStyles).toContain('@media (min-width: 48rem)')
    expect(routeStyles).toContain('@media (min-width: 60rem)')
    expect(routeStyles).not.toContain('100vw')
  })
})
