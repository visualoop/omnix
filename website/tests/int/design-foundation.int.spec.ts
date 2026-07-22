import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const globals = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
const rootLayout = readFileSync(join(ROOT, 'src/app/layout.tsx'), 'utf8')
const themeProvider = readFileSync(
  join(ROOT, 'src/components/theme/theme-provider.tsx'),
  'utf8',
)

describe('Working Counter design foundation', () => {
  it('uses a real light-first theme with explicit dark opt-in', () => {
    expect(themeProvider).toContain('defaultTheme="light"')
    expect(themeProvider).toContain('enableSystem={false}')
    expect(globals).toMatch(/html\s*\{[^}]*color-scheme:\s*light/s)
    expect(globals).toMatch(/html\.dark\s*\{[^}]*color-scheme:\s*dark/s)
  })

  it('uses the product-led sans and operational type roles', () => {
    expect(rootLayout).not.toContain('Fraunces')
    expect(rootLayout).toContain('Geist')
    expect(rootLayout).toContain('Plus_Jakarta_Sans')
    expect(rootLayout).toContain('JetBrains_Mono')
    expect(globals).toContain('--font-display: var(--font-geist)')
    expect(globals).toContain('--font-sans: var(--font-geist)')
    expect(globals).toContain('--font-mono: var(--font-jetbrains)')
  })

  it('defines the complete shared spacing, radius, motion, and width tokens', () => {
    for (const token of [
      '--space-1:', '--space-2:', '--space-3:', '--space-4:', '--space-6:',
      '--radius-sm:', '--radius-md:', '--radius-lg:', '--radius-pill:',
      '--duration-fast:', '--duration-ui:', '--ease-out:',
      '--w-narrow:', '--w-default:', '--w-wide:', '--w-bleed:',
    ]) {
      expect(globals, `missing ${token}`).toContain(token)
    }
  })

  it('prevents horizontal document overflow and respects reduced motion', () => {
    expect(globals).toMatch(/html\s*\{[^}]*overflow-x:\s*clip/s)
    expect(globals).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('removes the generic ambient radial-gradient page background', () => {
    const bodyBlock = globals.match(/body\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
    expect(bodyBlock).not.toContain('radial-gradient')
  })
})
