import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/safe-redirect'

/**
 * /signup is a thin redirector to /login — there is no public registration
 * or trial-acquisition form. Magic-link auto-creates the buyer account on
 * first email click, and Google does the same on first OAuth grant.
 *
 * Preserves the desktop/marketing hand-off params through the redirect:
 *
 *   ?variant=dawa    → post-sign-in target /dashboard?variant=dawa
 *                      (the trial wizard preselects Dawa)
 *   ?intent=buy      → came from a "Buy a licence" CTA → /buy(?variant=X)
 *   ?next=/foo       → legacy pass-through, last-resort target
 *
 * Resolution order: intent=buy → variant → next → /dashboard.
 * The resolved target is validated as an internal, non-privileged path
 * before it becomes the /login?next= destination.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; variant?: string; intent?: string }>
}) {
  const sp = (await searchParams) ?? {}

  let target: string
  if (sp.intent === 'buy') {
    target = sp.variant ? `/buy?variant=${encodeURIComponent(sp.variant)}` : '/buy'
  } else if (sp.variant) {
    target = `/dashboard?variant=${encodeURIComponent(sp.variant)}`
  } else if (sp.next) {
    target = sp.next
  } else {
    target = '/dashboard'
  }

  const safeTarget = safeNextPath(target)
  redirect(`/login?next=${encodeURIComponent(safeTarget)}`)
}
