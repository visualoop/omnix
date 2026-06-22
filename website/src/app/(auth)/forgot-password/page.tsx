import { redirect } from 'next/navigation'

// Passwordless website — there's nothing to forget. Send anyone who
// hits this URL to /login where they can request a new magic link.
export default function ForgotPasswordPage() {
  redirect('/login')
}
