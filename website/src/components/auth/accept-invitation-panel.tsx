'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { safeNextPath } from '@/lib/safe-redirect'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowRight, Check } from '@/components/icons'

interface PanelProps {
  invitationId: string
  orgName: string
}

type Phase = 'idle' | 'accepting' | 'declining' | 'accepted'

/**
 * Accept or decline an organisation invitation via Better Auth's
 * organization client. On accept the new member lands on the team page;
 * declining returns to the dashboard. The tokenised invitation id is the
 * only capability required — Better Auth re-checks recipient + expiry
 * server-side.
 */
export function AcceptInvitationPanel({ invitationId, orgName }: PanelProps) {
  const router = useRouter()
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const busy = phase === 'accepting' || phase === 'declining'

  async function accept() {
    setError(null)
    setPhase('accepting')
    const { error: err } = await authClient.organization.acceptInvitation({ invitationId })
    if (err) {
      setError('We could not accept this invitation. It may have expired — ask for a new one.')
      setPhase('idle')
      return
    }
    setPhase('accepted')
    router.push(safeNextPath('/dashboard/team'))
    router.refresh()
  }

  async function decline() {
    setError(null)
    setPhase('declining')
    const { error: err } = await authClient.organization.rejectInvitation({ invitationId })
    if (err) {
      setError('We could not decline this invitation. Try again.')
      setPhase('idle')
      return
    }
    router.push(safeNextPath('/dashboard'))
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="w-full sm:flex-1"
          onClick={accept}
          disabled={busy || phase === 'accepted'}
          aria-busy={phase === 'accepting'}
        >
          {phase === 'accepting' ? (
            'Joining…'
          ) : phase === 'accepted' ? (
            <>
              Joined
              <Check className="size-4" />
            </>
          ) : (
            <>
              Join {orgName}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={decline}
          disabled={busy || phase === 'accepted'}
          aria-busy={phase === 'declining'}
        >
          {phase === 'declining' ? 'Declining…' : 'Decline'}
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  )
}

/**
 * Sign the current user out and send them to sign-in with the invitation
 * preserved as the return target — used when the signed-in email is not
 * the invitation's recipient.
 */
export function SwitchAccountButton({ next }: { next: string }) {
  const [busy, setBusy] = React.useState(false)
  const target = safeNextPath(next)

  async function go() {
    setBusy(true)
    await authClient.signOut().catch(() => undefined)
    window.location.href = `/login?reason=invite&next=${encodeURIComponent(target)}`
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={go} disabled={busy} aria-busy={busy}>
      {busy ? 'Signing out…' : 'Sign in with a different email'}
    </Button>
  )
}
