import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { safeNextPath } from '@/lib/safe-redirect'

const ROOT = process.cwd()
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

describe('account access redirect safety', () => {
  it('preserves local paths, query strings, and fragments', () => {
    expect(safeNextPath('/dashboard?variant=dawa')).toBe('/dashboard?variant=dawa')
    expect(safeNextPath('/buy/license-1#payment')).toBe('/buy/license-1#payment')
    expect(safeNextPath('/onboarding')).toBe('/onboarding')
  })

  it('rejects external, protocol-relative, and backslash redirect targets', () => {
    for (const target of [
      'https://example.com/phish',
      '//example.com/phish',
      '/\\example.com/phish',
      'javascript:alert(1)',
      '',
    ]) {
      expect(safeNextPath(target)).toBe('/dashboard')
    }
  })

  it('supports a route-specific local fallback', () => {
    expect(safeNextPath('https://example.com', '/login')).toBe('/login')
  })
})

describe('Task 21 passwordless account redesign', () => {
  const signIn = source('src/components/auth/sign-in-form.tsx')
  const recovery = source('src/components/auth/forgot-password-form.tsx')
  const loginPage = source('src/app/(auth)/login/page.tsx')
  const signupPage = source('src/app/(auth)/signup/page.tsx')
  const onboardingPage = source('src/app/onboarding/page.tsx')
  const onboarding = source('src/components/dashboard/onboarding-wizard.tsx')

  it('keeps Better Auth Google and magic-link behavior without password inputs', () => {
    expect(signIn).toContain('authClient.signIn.social')
    expect(signIn).toContain("provider: 'google'")
    expect(signIn).toContain('authClient.signIn.magicLink')
    expect(signIn).toContain('callbackURL')
    expect(signIn).not.toContain('type="password"')
  })

  it('uses the same magic-link behavior for recovery and keeps its response generic', () => {
    expect(recovery).toContain('authClient.signIn.magicLink')
    expect(recovery).toContain('If an Omnix account can use that address')
    expect(recovery).not.toContain('/api/customers/forgot-password')
    expect(recovery).not.toContain('resetPassword')
  })

  it('guards both authenticated redirects and auth callback targets', () => {
    expect(loginPage).toContain('safeNextPath')
    expect(signupPage).toContain('safeNextPath')
    expect(signIn).toContain('safeNextPath')
  })

  it('retains session and first-run onboarding gates', () => {
    expect(onboardingPage).toContain("redirect('/login?next=/onboarding')")
    expect(onboardingPage).toContain('if (me.businessName && me.phoneNumber)')
    expect(onboardingPage).toContain("redirect('/dashboard')")
  })

  it('retains profile persistence and variant handoff while using shared controls', () => {
    expect(onboarding).toContain("fetch('/api/customers/me'")
    expect(onboarding).toContain('businessName: data.businessName')
    expect(onboarding).toContain('employeeCount: data.employeeCount')
    expect(onboarding).toContain('router.push(`/dashboard?variant=${encodeURIComponent(data.variant)}`)')
    expect(onboarding).toContain("from '@/components/ui/field'")
    expect(onboarding).toContain("from '@/components/ui/input'")
    expect(onboarding).toContain("from '@/components/ui/alert'")
  })
})

describe('Task 21 — shared AuthFrame, page states and gates', () => {
  const loginPage = source('src/app/(auth)/login/page.tsx')
  const forgotPage = source('src/app/(auth)/forgot-password/page.tsx')
  const verifyPage = source('src/app/(auth)/verify-email/[token]/page.tsx')
  const signInForm = source('src/components/auth/sign-in-form.tsx')
  const authFrame = source('src/components/auth/auth-frame.tsx')
  const dashLayout = source('src/app/(dashboard)/layout.tsx')

  it('renders the login route through the shared AuthFrame and marks it noindex', () => {
    expect(loginPage).toContain('AuthFrame')
    expect(loginPage).toContain('index: false')
  })

  it('surfaces session-expired and invitation sign-in reasons on the login route', () => {
    expect(loginPage).toContain('session-expired')
    expect(loginPage).toContain('invite')
  })

  it('reuses the AuthFrame for recovery and verification, both noindex', () => {
    expect(forgotPage).toContain('AuthFrame')
    expect(forgotPage).toContain('index: false')
    expect(verifyPage).toContain('AuthFrame')
    expect(verifyPage).toContain('index: false')
  })

  it('keeps anti-enumeration wording and never renders a password input', () => {
    expect(signInForm).toContain('If an Omnix account can use')
    expect(signInForm).not.toContain('type="password"')
  })

  it('builds the AuthFrame on shared layout primitives without a nested main landmark', () => {
    expect(authFrame).toContain('PageContainer')
    expect(authFrame).not.toMatch(/<main[\s>]/)
  })

  it('preserves the intended path when the dashboard gate bounces to sign-in', () => {
    expect(dashLayout).toContain('/login?next=')
    expect(dashLayout).toContain('x-omnix-url')
  })
})
