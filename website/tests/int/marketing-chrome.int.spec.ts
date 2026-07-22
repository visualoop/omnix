import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const header = readFileSync(join(ROOT, 'src/components/layout/site-header.tsx'), 'utf8')
const footer = readFileSync(join(ROOT, 'src/components/layout/site-footer.tsx'), 'utf8')
const frontendLayout = readFileSync(join(ROOT, 'src/app/[locale]/(frontend)/layout.tsx'), 'utf8')

describe('global marketing navigation and footer', () => {
  it('presents exactly the five public products in acquisition chrome', () => {
    for (const product of ['Pharmacy', 'Retail', 'Hospitality', 'Hardware & Equipment', 'Salon & Spa']) {
      expect(header).toContain(`label: '${product}'`)
      expect(footer).toContain(`label: '${product}'`)
    }
    expect(header).toContain("href: '/salon'")
    expect(footer).toContain("href: '/salon'")
    expect(header).not.toContain("href: '/ai'")
    expect(footer).not.toContain("href: '/ai'")
  })

  it('makes demo booking primary and removes public trial acquisition', () => {
    expect(header).toContain("href: '/contact?type=demo'")
    expect(header).toContain('Book a demo')
    expect(header).not.toContain("href=\"/signup\"")
    expect(header).not.toContain("t('startTrial')")
    expect(footer).toContain('Book a demo')
    expect(footer).toContain('WhatsApp')
  })

  it('keeps marketing links inside the active locale', () => {
    expect(header).toContain('localePath(')
    expect(footer).toContain('localePath(')
    expect(frontendLayout).toContain('<SiteHeader locale={locale}')
    expect(frontendLayout).toContain('<SiteFooter locale={locale}')
  })

  it('uses the shared wide container and removes the old hard-coded footer width', () => {
    expect(footer).toContain('<PageContainer width="wide"')
    expect(footer).not.toContain('max-w-[1180px]')
  })

  it('provides keyboard and current-page navigation semantics', () => {
    expect(header).toContain('Skip to main content')
    expect(header).toContain('aria-current={active ? \'page\' : undefined}')
    expect(header).toContain("event.key === 'Escape'")
  })
})
