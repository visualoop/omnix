import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PAGE_ROUTE_GROUPS } from '@/config/route-inventory'

const ROOT = process.cwd()
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

describe('Task 21 — organisation invitation acceptance', () => {
  const page = source('src/app/(auth)/accept-invitation/[id]/page.tsx')
  const panel = source('src/components/auth/accept-invitation-panel.tsx')
  const middleware = source('src/middleware.ts')

  it('registers the invitation route in the auth group inventory', () => {
    expect(PAGE_ROUTE_GROUPS.auth).toContain('/accept-invitation/[id]')
  })

  it('gates unauthenticated visitors to sign-in, preserving the invite target', () => {
    expect(page).toContain('auth.api.getSession')
    expect(page).toContain('/login?reason=invite&next=')
    expect(page).toContain('encodeURIComponent(returnTarget)')
  })

  it('resolves the invitation from the org tables and checks recipient, status and expiry', () => {
    expect(page).toContain('.from(invitation)')
    expect(page).toContain('organization')
    expect(page).toContain("inv.status !== 'pending'")
    expect(page).toContain('expiresAt')
    expect(page).toContain('inv.email.toLowerCase()')
    expect(page).toContain('sessionEmail')
  })

  it('accepts and declines through the Better Auth organization client', () => {
    expect(panel).toContain('authClient.organization.acceptInvitation')
    expect(panel).toContain('authClient.organization.rejectInvitation')
    expect(panel).toContain('invitationId')
  })

  it('keeps every post-action redirect on this site', () => {
    expect(panel).toContain('safeNextPath')
  })

  it('stays out of the index and unprefixed by locale', () => {
    expect(page).toContain('index: false')
    expect(middleware).toContain("pathname.startsWith('/accept-invitation')")
  })
})
