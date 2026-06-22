'use client'

/**
 * Better Auth client — used in client components for sign-in flows,
 * `useSession()` reactive hook, organization/admin actions, etc.
 *
 * Server-side code should call `auth.api.*` from '@/lib/auth' directly.
 */
import { createAuthClient } from 'better-auth/react'
import {
  magicLinkClient,
  organizationClient,
  adminClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins'
import type { auth } from '@/lib/auth'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  plugins: [
    magicLinkClient(),
    organizationClient(),
    adminClient(),
    inferAdditionalFields<typeof auth>(),
  ],
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
} = authClient
