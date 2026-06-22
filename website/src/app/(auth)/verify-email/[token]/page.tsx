import { redirect } from 'next/navigation'

// Magic-link sign-in inherently verifies the email. There's no separate
// verify-email step in the new auth flow. Redirect any stale links.
export default function VerifyEmailPage() {
  redirect('/login')
}
