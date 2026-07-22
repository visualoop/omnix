import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const downloadsSource = read('src/app/[locale]/(frontend)/downloads/page.tsx')
const migrationSource = read('src/app/[locale]/(frontend)/migration/page.tsx')
const downloadsCss = read('src/app/[locale]/(frontend)/downloads/downloads.module.css')
const migrationCss = read('src/app/[locale]/(frontend)/migration/migration.module.css')

describe('Task 14 downloads acquisition route', () => {
  it('keeps installers behind customer sign-in and explains all five purchased editions', () => {
    for (const phrase of [
      'Install after purchase.',
      'customer dashboard',
      'Customer sign-in required',
      'Activation still required',
      'No installer files or protected release addresses are published',
      'Assistance does not bypass sign-in, licence activation, device limits',
    ]) {
      expect(downloadsSource).toContain(phrase)
    }
    for (const edition of [
      'Pharmacy',
      'Retail',
      'Hospitality',
      'Hardware & Equipment',
      'Salon & Spa',
    ]) {
      expect(downloadsSource).toContain(`name: '${edition}'`)
    }
    expect(downloadsSource).not.toContain("name: 'Dawa'")
    expect(downloadsSource).toContain('/login?next=%2Fdashboard%2Fdownloads')
    expect(downloadsSource).not.toMatch(/github\.com|releases\/download|\.exe\b|\.msi\b|Omnix Pro/i)
    expect(downloadsSource).not.toMatch(/free trial|start trial|\/buy\?variant/i)
    expect(downloadsSource).not.toContain("import('@/db')")
  })

  it('uses localized demo primaries, configured WhatsApp secondaries, and route metadata', () => {
    expect(downloadsSource).toContain('const demoHref = `/${locale}/contact?type=demo`')
    expect(downloadsSource).toContain('whatsappHref(settings.whatsappUrl)')
    expect(downloadsSource).toContain('Book a demo')
    expect(downloadsSource).toContain('Ask on WhatsApp')

    expect(downloadsSource).toContain('`${SITE_URL}/${locale}/downloads`')
    expect(downloadsSource).toContain("buildAlternatesLanguages('/downloads')")
  })
})

describe('Task 14 migration acquisition route', () => {
  it('covers books, spreadsheets and other POS through backups, mapping and owner validation', () => {
    for (const phrase of [
      'Paper stock and account books',
      'Excel or CSV spreadsheets',
      'Another point-of-sale system',
      'Discover the scope',
      'Preserve the source',
      'Map a sample',
      'Import and validate',
      'Cut over deliberately',
      'owner approve opening figures',
    ]) {
      expect(migrationSource).toContain(phrase)
    }
    expect(migrationSource).toContain('A successful import is not an accounting audit')
    expect(migrationSource).toContain('We do not guarantee a same-day cutover')
    expect(migrationSource).not.toMatch(
      /AI assistant|vision OCR|work first time|Switch in an afternoon/i,
    )
  })

  it('keeps migration conversion localized and demo-led without a trial or guarantee CTA', () => {
    expect(migrationSource).toContain('const demoHref = `/${locale}/contact?type=demo`')
    expect(migrationSource).toContain('whatsappHref(settings.whatsappUrl)')
    expect(migrationSource).toContain('Book a migration demo')
    expect(migrationSource).toContain('Ask on WhatsApp')
    expect(migrationSource).not.toMatch(/free trial|start trial|guaranteed migration/i)

    expect(migrationSource).toContain('`${SITE_URL}/${locale}/migration`')
    expect(migrationSource).toContain("buildAlternatesLanguages('/migration')")
  })
})

describe('Task 14 route presentation constraints', () => {
  it('uses Working Counter, narrow-width fallbacks, and no unapproved media', () => {
    for (const css of [downloadsCss, migrationCss]) {
      expect(css).toContain('theme: Working Counter')
      expect(css).toMatch(/overflow-x:\s*clip/)
      expect(css).toMatch(/@media\s*\(max-width:\s*40rem\)/)
      expect(css).toMatch(/minmax\(0,\s*1fr\)/)
      expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    }
    for (const source of [downloadsSource, migrationSource]) {
      expect(source).not.toMatch(/<Image|<img|<video|backgroundImage|getSlot(Image|Media)/)
      expect(source).not.toContain('href="/signup"')
      expect(source).not.toContain('href="/buy')
    }
  })
})
