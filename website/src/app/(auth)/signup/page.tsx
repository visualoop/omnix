import { redirect } from 'next/navigation'

/**
 * /signup is a thin redirector to /login.
 *
 * Magic-link auto-creates the user on first email click, and Google does
 * the same on first OAuth grant — so there's no separate sign-up form.
 *
 * Preserves three URL params through the redirect:
 *
 *   ?variant=dawa    desktop activation flow (or trade-landing CTA)
 *                    → routes to /dashboard?variant=dawa post-sign-in,
 *                      where the trial wizard preselects Dawa
 *
 *   ?intent=buy      came from "Buy a licence" CTA
 *                    → routes to /buy post-sign-in
 *
 *   ?next=/foo       legacy pass-through, last-resort target
 *
 * Order of preference for resolving the post-sign-in target:
 *   intent=buy  →  /buy(?variant=X)
 *   variant=X   →  /dashboard?variant=X
 *   next=/foo   →  /foo
 *   default     →  /dashboard
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; variant?: string; intent?: string }>
}) {
  const sp = (await searchParams) ?? {}

  let nextTarget: string
  if (sp.intent === 'buy') {
    nextTarget = sp.variant ? `/buy?variant=${encodeURIComponent(sp.variant)}` : '/buy'
  } else if (sp.variant) {
    nextTarget = `/dashboard?variant=${encodeURIComponent(sp.variant)}`
  } else if (sp.next) {
    nextTarget = sp.next
  } else {
    nextTarget = '/dashboard'
  }

  redirect(`/login?next=${encodeURIComponent(nextTarget)}`)
}
