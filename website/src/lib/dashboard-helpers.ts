import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Resolve the signed-in customer for dashboard SSR pages.
 *
 * Returns the user object (Better Auth shape) on success. On no-session,
 * redirects to /login with ?next= so the post-sign-in lands them where
 * they meant to go.
 */
export async function getDashboardCustomer(reqHeaders: Headers): Promise<{
  id: string
  email: string
  fullName?: string
  businessName?: string
}> {
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard')

  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.name,
    businessName: (session.user as { businessName?: string }).businessName,
  }
}

/** Empty page shape used by safePayloadFind callers. */
export function emptyPage<T>(): { docs: T[]; totalDocs: number } {
  return { docs: [], totalDocs: 0 }
}

/**
 * Wrap a Drizzle (or any) async query so that unexpected errors surface
 * as the empty-page shape instead of throwing — keeps the dashboard
 * resilient when DB rows are sparse.
 */
export async function safePayloadFind<T>(
  fn: () => Promise<{ docs: T[]; totalDocs?: number }>,
  fallback: { docs: T[]; totalDocs: number },
  context = 'dashboard',
): Promise<{ docs: T[]; totalDocs: number }> {
  try {
    const result = await fn()
    return { docs: result.docs, totalDocs: result.totalDocs ?? result.docs.length }
  } catch (err) {
    console.error(`[${context}] query failed:`, err)
    return fallback
  }
}
