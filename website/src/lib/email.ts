/**
 * Email helper — Resend SDK.
 *
 * Replaces @payloadcms/email-resend. Same RESEND_API_KEY env var.
 * Templates inline (plain HTML for now; React Email components later).
 */
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY ?? ''

const resend = new Resend(apiKey || 'stub-key')

const FROM = process.env.RESEND_FROM ?? 'Omnix <noreply@omnix.co.ke>'
const REPLY_TO = process.env.RESEND_REPLY_TO ?? 'support@omnix.co.ke'

interface MagicLinkInput {
  to: string
  url: string
}

export async function sendMagicLinkEmail({ to, url }: MagicLinkInput) {
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing — magic link not sent')
    console.warn(`[email] would have sent to ${to}: ${url}`)
    return
  }
  await resend.emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject: 'Your Omnix sign-in link',
    html: magicLinkTemplate({ url }),
    text: `Sign in to Omnix: ${url}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this message.`,
  })
}

interface InviteInput {
  email: string
  inviteLink: string
  inviterName: string
  orgName: string
}

export async function sendInviteEmail({ email, inviteLink, inviterName, orgName }: InviteInput) {
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing — invite not sent')
    return
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: REPLY_TO,
    subject: `${inviterName} invited you to join ${orgName} on Omnix`,
    html: inviteTemplate({ inviteLink, inviterName, orgName }),
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
  if (!apiKey) return
  await resend.emails.send({
    from: FROM,
    to: input.to,
    replyTo: REPLY_TO,
    subject: `Receipt — ${input.currency} ${input.amount.toLocaleString()} paid to Omnix`,
    html: paymentReceiptTemplate(input),
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
  if (!apiKey) return
  await resend.emails.send({
    from: FROM,
    to: input.to,
    replyTo: REPLY_TO,
    subject: `Re: ${input.ticketSubject} (#${input.ticketId.slice(0, 8)})`,
    html: supportReplyTemplate(input),
    text: `${input.agentName} replied to your ticket:\n\n${input.body}\n\nReply at https://omnix.co.ke/dashboard/support/${input.ticketId}`,
  })
}

// ─── HTML templates (plain, brand-coloured) ────────────────────────

function shell(content: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;background:#FBFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6b6b;margin-bottom:12px;">Omnix</div>
          ${content}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function magicLinkTemplate({ url }: { url: string }): string {
  return shell(`
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:500;line-height:1.1;margin:0 0 12px;">Sign in to Omnix</h1>
    <p style="font-size:14px;line-height:1.55;color:#444;margin:0 0 24px;">Click the button below to sign in. The link expires in 15&nbsp;minutes.</p>
    <a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">Sign in</a>
    <p style="font-size:12px;color:#888;margin:32px 0 0;line-height:1.55;">If the button doesn't work, paste this URL into your browser:<br /><a href="${url}" style="color:#888;word-break:break-all;">${url}</a></p>
    <p style="font-size:11px;color:#888;margin:24px 0 0;line-height:1.55;">If you didn't request this, you can safely ignore the email — no account changes happen until someone clicks the link.</p>
  `)
}

function inviteTemplate({ inviteLink, inviterName, orgName }: { inviteLink: string; inviterName: string; orgName: string }): string {
  return shell(`
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:500;line-height:1.15;margin:0 0 12px;">${inviterName} invited you to ${orgName}</h1>
    <p style="font-size:14px;line-height:1.55;color:#444;margin:0 0 24px;">You'll be added as a member of <b>${orgName}</b> on Omnix. Click the button to accept.</p>
    <a href="${inviteLink}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">Accept invitation</a>
    <p style="font-size:11px;color:#888;margin:24px 0 0;line-height:1.55;">This invitation expires in 48&nbsp;hours.</p>
  `)
}

function paymentReceiptTemplate({ customerName, amount, currency, reference, purpose, date }: PaymentReceiptInput): string {
  return shell(`
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:500;margin:0 0 12px;">Receipt</h1>
    <p style="font-size:14px;color:#444;margin:0 0 16px;">Thanks ${customerName}. Your payment was received.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(0,0,0,0.08);border-bottom:1px solid rgba(0,0,0,0.08);margin:16px 0;">
      <tr><td style="padding:8px 0;font-size:13px;color:#6b6b6b;">Amount</td><td style="padding:8px 0;font-size:13px;text-align:right;font-family:monospace;">${currency} ${amount.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#6b6b6b;">For</td><td style="padding:8px 0;font-size:13px;text-align:right;">${purpose.replace(/_/g, ' ')}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#6b6b6b;">Reference</td><td style="padding:8px 0;font-size:12px;text-align:right;font-family:monospace;color:#888;">${reference}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#6b6b6b;">Date</td><td style="padding:8px 0;font-size:13px;text-align:right;">${date}</td></tr>
    </table>
    <a href="https://omnix.co.ke/dashboard" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">Open dashboard</a>
  `)
}

function supportReplyTemplate({ ticketSubject, ticketId, body, agentName }: SupportReplyInput): string {
  return shell(`
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:500;margin:0 0 8px;">${ticketSubject}</h1>
    <p style="font-size:11px;color:#888;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.1em;">${agentName} · Omnix support</p>
    <div style="font-size:14px;line-height:1.6;color:#222;border-left:3px solid rgba(0,0,0,0.15);padding:0 0 0 16px;margin:16px 0;white-space:pre-wrap;">${body.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'))}</div>
    <a href="https://omnix.co.ke/dashboard/support/${ticketId}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">View ticket</a>
  `)
}
