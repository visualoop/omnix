import { redirect } from 'next/navigation'

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  // Sign-in and sign-up are the same operation when there's no password.
  // Magic-link auto-creates the user on first email click; Google does the
  // same on first OAuth grant. So /signup just sends people to /login.
  const sp = (await searchParams) ?? {}
  const qs = sp.next ? `?next=${encodeURIComponent(sp.next)}` : ''
  redirect(`/login${qs}`)
}
