/**
 * Email helper — Resend SDK + React Email templates.
 *
 * Reads resend.api_key + resend.from_email + resend.reply_to from
 * platform_settings (admin-editable) with env fallback. Templates live
 * in src/emails/templates.tsx as React components — rendered to HTML
 * at send time via @react-email/render.
 */
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { resendConfig } from '@/lib/platform-settings'
import {
  MagicLinkEmail,
  InviteEmail,
  PaymentReceiptEmail,
  SupportReplyEmail,
  DiagnosticEmail,
} from '@/emails/templates'

interface ResolvedConfig {
  client: Resend | null
  from: string
  replyTo: string
}

async function getResend(): Promise<ResolvedConfig> {
  const cfg = await resendConfig()
  const from = cfg.from ?? 'Omnix <noreply@omnix.co.ke>'
  const replyTo = cfg.replyTo ?? 'support@omnix.co.ke'
  if (!cfg.apiKey) {
    return { client: null, from, replyTo }
  }
  return { client: new Resend(cfg.apiKey), from, replyTo }
}

interface MagicLinkInput {
  to: string
  url: string
}

export async function sendMagicLinkEmail({ to, url }: MagicLinkInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) {
    console.warn('[email] resend.api_key missing — magic link not sent')
    console.warn(`[email] would have sent to ${to}: ${url}`)
    return
  }
  const html = await render(MagicLinkEmail({ url, expiresInMinutes: 15 }))
  const text = `Sign in to Omnix: ${url}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this message.`

  const result = await client.emails.send({
    from,
    to,
    replyTo,
    subject: 'Your Omnix sign-in link',
    html,
    text,
  })
  if (result.error) {
    console.error('[email] magic-link send failed:', result.error)
    throw new Error(`Magic link send failed: ${result.error.message ?? 'unknown'}`)
  }
}

interface InviteInput {
  email: string
  inviteLink: string
  inviterName: string
  orgName: string
}

export async function sendInviteEmail({ email, inviteLink, inviterName, orgName }: InviteInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) {
    console.warn('[email] resend.api_key missing — invite not sent')
    return
  }
  const html = await render(InviteEmail({ inviteLink, inviterName, orgName }))
  await client.emails.send({
    from,
    to: email,
    replyTo,
    subject: `${inviterName} invited you to join ${orgName} on Omnix`,
    html,
    text: `${inviterName} invited you to join ${orgName} on Omnix.\n\nAccept here: ${inviteLink}\n\nThis link expires in 48 hours.`,
  })
}

interface PaymentReceiptInput {
  to: string
  customerName: string
  amount: number
  currency: string
  reference: string
  purpose: string
  date: string
}

export async function sendPaymentReceiptEmail(input: PaymentReceiptInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const html = await render(
    PaymentReceiptEmail({
      customerName: input.customerName,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      purpose: input.purpose,
      date: input.date,
    }),
  )
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Receipt — ${input.currency} ${input.amount.toLocaleString()} paid to Omnix`,
    html,
  })
}

interface SupportReplyInput {
  to: string
  ticketSubject: string
  ticketId: string
  body: string
  agentName: string
}

export async function sendSupportReplyEmail(input: SupportReplyInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const html = await render(
    SupportReplyEmail({
      ticketSubject: input.ticketSubject,
      ticketId: input.ticketId,
      body: input.body,
      agentName: input.agentName,
    }),
  )
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Re: ${input.ticketSubject} (#${input.ticketId.slice(0, 8)})`,
    html,
    text: `${input.agentName} replied to your ticket:\n\n${input.body}\n\nReply at https://omnix.co.ke/dashboard/support/${input.ticketId}`,
  })
}

/**
 * Send an arbitrary test email — used by /admin/settings → "Send test"
 * and /api/admin/settings/test {type:'email'}.
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const { client, from, replyTo } = await getResend()
  if (!client) return { ok: false, error: 'resend.api_key not set' }
  try {
    const html = await render(DiagnosticEmail({ from, sentAt: new Date().toISOString() }))
    const result = await client.emails.send({
      from,
      to,
      replyTo,
      subject: 'Test email from Omnix admin',
      html,
      text: 'It works. Resend is correctly configured.',
    })
    if (result.error) {
      return { ok: false, error: result.error.message ?? 'send failed' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
