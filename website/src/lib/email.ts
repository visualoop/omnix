/**
 * Email helper — Resend SDK + React Email templates.
 *
 * Reads resend.api_key + resend.from_email + resend.reply_to from
 * platform_settings (admin-editable) with env fallback. Branding values
 * (footer tagline, support contacts, address) come from the
 * email_branding category.
 *
 * Every send function returns void; failures are surfaced via thrown
 * errors. Senders MUST handle errors at the call site if they need
 * non-fatal behaviour.
 */
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { resendConfig, emailBranding } from '@/lib/platform-settings'
import {
  MagicLinkEmail,
  WelcomeEmail,
  InviteEmail,
  LicenseKeyEmail,
  PaymentReceiptEmail,
  PaymentFailedEmail,
  TrialEndingEmail,
  MaintenanceEndingEmail,
  MaintenanceLapsedEmail,
  CloudBackupEndingEmail,
  SupportReplyEmail,
  DiagnosticEmail,
  TeamInviteEmail,
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
  if (!cfg.apiKey) return { client: null, from, replyTo }
  return { client: new Resend(cfg.apiKey), from, replyTo }
}

// ─── Magic link ─────────────────────────────────────────

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }) {
  const { client, from, replyTo } = await getResend()
  if (!client) {
    console.warn(`[email] resend.api_key missing — magic link not sent to ${to}`)
    return
  }
  const brand = await emailBranding()
  const html = await render(MagicLinkEmail({ url, expiresInMinutes: 15, brand }))
  const result = await client.emails.send({
    from,
    to,
    replyTo,
    subject: 'Your Omnix sign-in link',
    html,
    text: `Sign in to Omnix: ${url}\n\nExpires in 15 minutes. Ignore if you didn't request it.`,
  })
  if (result.error) throw new Error(`Magic link send failed: ${result.error.message ?? 'unknown'}`)
}

// ─── Welcome ───────────────────────────────────────────

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(WelcomeEmail({ name, brand }))
  await client.emails.send({
    from,
    to,
    replyTo,
    subject: `Welcome to Omnix, ${name}`,
    html,
    text: `Welcome to Omnix. Open your dashboard at ${brand.brandUrl}/dashboard.`,
  })
}

// ─── Invite ────────────────────────────────────────────

export async function sendInviteEmail({ email, inviteLink, inviterName, orgName }: {
  email: string; inviteLink: string; inviterName: string; orgName: string
}) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(InviteEmail({ inviteLink, inviterName, orgName, brand }))
  await client.emails.send({
    from,
    to: email,
    replyTo,
    subject: `${inviterName} invited you to ${orgName} on Omnix`,
    html,
    text: `${inviterName} invited you to ${orgName} on Omnix. Accept here: ${inviteLink}`,
  })
}

// ─── License key delivery (purchase confirmation) ────

interface LicenseKeyInput {
  to: string
  customerName: string
  licenseKey: string
  variant: string
  amountPaid: number
  currency: string
  reference: string
  date: string
  downloadUrl: string
  maintenanceUntil: string
}

export async function sendLicenseKeyEmail(input: LicenseKeyInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) {
    console.warn(`[email] resend.api_key missing — license key not delivered to ${input.to}`)
    return
  }
  const brand = await emailBranding()
  const html = await render(LicenseKeyEmail({ ...input, brand }))
  const result = await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Your Omnix ${input.variant} licence is ready`,
    html,
    text: `Hi ${input.customerName},

Your Omnix ${input.variant} licence is ready.

Licence key: ${input.licenseKey}

Download: ${input.downloadUrl}
Maintenance until: ${input.maintenanceUntil}
Reference: ${input.reference}

To activate: install Omnix, open it, paste the licence key into the activation screen.`,
  })
  if (result.error) throw new Error(`License key send failed: ${result.error.message ?? 'unknown'}`)
}

// ─── Payment receipt ───────────────────────────────────

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
  const brand = await emailBranding()
  const html = await render(PaymentReceiptEmail({ ...input, brand }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Receipt — ${input.currency} ${input.amount.toLocaleString()} paid to Omnix`,
    html,
  })
}

// ─── Payment failed ────────────────────────────────────

interface PaymentFailedInput {
  to: string
  customerName: string
  amount: number
  currency: string
  reference: string
  purpose: string
  reason: string
  retryUrl: string
}

export async function sendPaymentFailedEmail(input: PaymentFailedInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(PaymentFailedEmail({ ...input, brand }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Your Omnix payment didn't go through`,
    html,
  })
}

// ─── Trial ending ──────────────────────────────────────

interface TrialEndingInput {
  to: string
  customerName: string
  variant: string
  daysLeft: number
  buyUrl: string
}

export async function sendTrialEndingEmail(input: TrialEndingInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(TrialEndingEmail({ ...input, brand }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: input.daysLeft <= 1
      ? `Last day of your Omnix ${input.variant} trial`
      : `${input.daysLeft} days left on your Omnix ${input.variant} trial`,
    html,
  })
}

// ─── Maintenance ending ────────────────────────────────

interface MaintenanceEndingInput {
  to: string
  customerName: string
  variant: string
  daysLeft: number
  expiresOn: string
  renewUrl: string
}

export async function sendMaintenanceEndingEmail(input: MaintenanceEndingInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(MaintenanceEndingEmail({ ...input, brand }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Renew your Omnix ${input.variant} maintenance`,
    html,
  })
}

// ─── Maintenance lapsed ────────────────────────────────

interface MaintenanceLapsedInput {
  to: string
  customerName: string
  variant: string
  expiredOn: string
  renewUrl: string
}

export async function sendMaintenanceLapsedEmail(input: MaintenanceLapsedInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(MaintenanceLapsedEmail({ ...input, brand }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Your Omnix ${input.variant} maintenance has lapsed`,
    html,
  })
}

// ─── Cloud backup ending ──────────────────────────────

interface CloudBackupEndingInput {
  to: string
  customerName: string
  daysLeft: number
  expiresOn: string
  renewUrl: string
}

export async function sendCloudBackupEndingEmail(input: CloudBackupEndingInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) return
  const brand = await emailBranding()
  const html = await render(CloudBackupEndingEmail({ ...input, brand }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Your Omnix cloud backup ends ${input.expiresOn}`,
    html,
  })
}

// ─── Support reply ────────────────────────────────────

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
  const brand = await emailBranding()
  const html = await render(SupportReplyEmail({
    ticketSubject: input.ticketSubject,
    ticketId: input.ticketId,
    body: input.body,
    agentName: input.agentName,
    brand,
  }))
  await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `Re: ${input.ticketSubject} (#${input.ticketId.slice(0, 8)})`,
    html,
    text: `${input.agentName} replied:\n\n${input.body}\n\nReply at ${brand.brandUrl}/dashboard/support/${input.ticketId}`,
  })
}

// ─── Team invite (staff onboarding) ──────────────────

interface TeamInviteInput {
  to: string
  inviterName: string
  inviteeName: string
  role: 'platform_admin' | 'support_agent' | 'sales_rep'
  signInUrl: string
}

export async function sendTeamInviteEmail(input: TeamInviteInput) {
  const { client, from, replyTo } = await getResend()
  if (!client) {
    console.warn(`[email] resend.api_key missing — team invite not sent to ${input.to}`)
    return
  }
  const brand = await emailBranding()
  const html = await render(TeamInviteEmail({ ...input, brand }))
  const result = await client.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: `${input.inviterName} added you to the Omnix team`,
    html,
    text: `${input.inviterName} added you to the Omnix team as ${input.role.replace('_', ' ')}.\n\nSign in: ${input.signInUrl}\n\nLink expires in 15 minutes.`,
  })
  if (result.error) throw new Error(`Team invite send failed: ${result.error.message ?? 'unknown'}`)
}

// ─── Diagnostic test ─────────────────────────────────

export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const { client, from, replyTo } = await getResend()
  if (!client) return { ok: false, error: 'resend.api_key not set' }
  try {
    const brand = await emailBranding()
    const html = await render(DiagnosticEmail({ from, sentAt: new Date().toISOString(), brand }))
    const result = await client.emails.send({
      from,
      to,
      replyTo,
      subject: 'Test email from Omnix admin',
      html,
      text: 'It works. Resend is correctly configured.',
    })
    if (result.error) return { ok: false, error: result.error.message ?? 'send failed' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
