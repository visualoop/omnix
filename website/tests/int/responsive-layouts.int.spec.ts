import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const primitivesPath = join(ROOT, 'src/components/layout/layout-primitives.tsx')
const section = read('src/components/ui/section.tsx')
const pageHeader = read('src/components/layout/page-header.tsx')
const entityHero = read('src/components/layout/entity-hero.tsx')
const dashboardShell = read('src/components/dashboard/dashboard-shell.tsx')
const adminShell = read('src/components/admin/admin-shell.tsx')
const authLayout = read('src/app/(auth)/layout.tsx')

describe('responsive layout foundation', () => {
  it('provides shared page, stack, cluster, split, app-page, and centered-shell primitives', () => {
    expect(existsSync(primitivesPath)).toBe(true)
    const primitives = read('src/components/layout/layout-primitives.tsx')
    for (const name of [
      'PageContainer',
      'PageStack',
      'Cluster',
      'SplitLayout',
      'AppPage',
      'CenteredShell',
    ]) {
      expect(primitives, `missing ${name}`).toContain(`function ${name}`)
    }
  })

  it('uses token-backed section rhythm and mobile-safe container gutters', () => {
    expect(section).toContain("tight: 'section-tight'")
    expect(section).toContain("default: 'section'")
    expect(section).toContain("loose: 'section-loose'")
    expect(section).not.toContain('py-14 sm:py-20')
  })

  it('makes application shells viewport-safe and routes content through AppPage', () => {
    expect(dashboardShell).toContain('min-h-dvh')
    expect(dashboardShell).toContain('<AppPage')
    expect(adminShell).toContain('min-h-dvh')
    expect(adminShell).toContain('<AppPage')
    expect(authLayout).toContain('min-h-dvh')
    expect(authLayout).toContain('<PageContainer')
  })

  it('uses the current type and semantic token roles in shared page headers', () => {
    for (const source of [pageHeader, entityHero]) {
      expect(source).not.toContain('serif')
    }
    expect(entityHero).toContain('var(--color-positive)')
    expect(entityHero).toContain('var(--color-caution)')
    expect(entityHero).toContain('var(--color-negative)')
  })

  it('keeps header actions and entity statistics responsive at narrow widths', () => {
    expect(pageHeader).toContain('max-sm:[&>*]:w-full')
    expect(entityHero).toContain('grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]')
    expect(entityHero).not.toContain('lg:grid-cols-6')
  })
})
