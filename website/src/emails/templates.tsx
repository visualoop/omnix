/**
 * Email templates — React Email components.
 *
 * Editorial cream-paper design language matched to the marketing site:
 * Fraunces (Georgia fallback) for headlines, hairline rules, mono caps
 * eyebrows, generous whitespace. No card shadows, no gradients.
 *
 * Rendered to HTML at send time via @react-email/render.
 */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// ─── Shared layout primitives ────────────────────────────────

const colors = {
  bg: '#FBFAF6',
  surface: '#ffffff',
  fg: '#1a1a1a',
  fgMuted: '#6b6b6b',
  fgSubtle: '#888888',
  accent: '#1a1a1a',
  border: 'rgba(0,0,0,0.10)',
}

const fontStack = {
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  display: 'Fraunces, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
}

interface ShellProps {
  preview: string
  children: React.ReactNode
}

function Shell({ preview, children }: ShellProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, fontFamily: fontStack.body, color: colors.fg, margin: 0 }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '40px 16px' }}>
          <Section
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '32px',
            }}
          >
            <Text
              style={{
                fontFamily: fontStack.mono,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: colors.fgMuted,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Omnix
            </Text>
            {children}
          </Section>
          <Text style={{ marginTop: 24, fontSize: 11, color: colors.fgSubtle, textAlign: 'center' }}>
            Omnix · Offline-first ERP for Kenyan SMEs · <Link href="https://omnix.co.ke" style={{ color: colors.fgSubtle }}>omnix.co.ke</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Magic link ──────────────────────────────────────────────

interface MagicLinkProps {
  url: string
  expiresInMinutes?: number
}

export function MagicLinkEmail({ url, expiresInMinutes = 15 }: MagicLinkProps) {
  return (
    <Shell preview={`Sign in to Omnix · expires in ${expiresInMinutes} min`}>
      <Heading
        as="h1"
        style={{
          fontFamily: fontStack.display,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.1,
          margin: 0,
          marginBottom: 12,
          color: colors.fg,
        }}
      >
        Sign in to Omnix
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: '#444', margin: 0, marginBottom: 24 }}>
        Click the button below to sign in. The link expires in {expiresInMinutes}&nbsp;minutes.
      </Text>
      <Button
        href={url}
        style={{
          display: 'inline-block',
          backgroundColor: colors.accent,
          color: '#fff',
          textDecoration: 'none',
          padding: '12px 24px',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Sign in
      </Button>
      <Hr style={{ borderColor: colors.border, marginTop: 32, marginBottom: 16 }} />
      <Text style={{ fontSize: 12, color: colors.fgSubtle, lineHeight: 1.55, margin: 0 }}>
        If the button doesn&apos;t work, paste this URL into your browser:
      </Text>
      <Text style={{ fontSize: 11, fontFamily: fontStack.mono, color: colors.fgSubtle, lineHeight: 1.55, marginTop: 6, marginBottom: 0, wordBreak: 'break-all' }}>
        <Link href={url} style={{ color: colors.fgSubtle }}>{url}</Link>
      </Text>
      <Text style={{ fontSize: 11, color: colors.fgSubtle, lineHeight: 1.55, marginTop: 16, marginBottom: 0 }}>
        Didn&apos;t request this? Ignore the email — no account changes happen until someone clicks the link.
      </Text>
    </Shell>
  )
}

// ─── Invitation ──────────────────────────────────────────────

interface InviteEmailProps {
  inviteLink: string
  inviterName: string
  orgName: string
}

export function InviteEmail({ inviteLink, inviterName, orgName }: InviteEmailProps) {
  return (
    <Shell preview={`${inviterName} invited you to ${orgName} on Omnix`}>
      <Heading
        as="h1"
        style={{
          fontFamily: fontStack.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.15,
          margin: 0,
          marginBottom: 12,
          color: colors.fg,
        }}
      >
        {inviterName} invited you to {orgName}
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: '#444', margin: 0, marginBottom: 24 }}>
        You&apos;ll be added as a member of <strong>{orgName}</strong> on Omnix. Click the button to accept.
      </Text>
      <Button
        href={inviteLink}
        style={{
          display: 'inline-block',
          backgroundColor: colors.accent,
          color: '#fff',
          textDecoration: 'none',
          padding: '12px 24px',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Accept invitation
      </Button>
      <Text style={{ fontSize: 11, color: colors.fgSubtle, lineHeight: 1.55, marginTop: 24, marginBottom: 0 }}>
        This invitation expires in 48&nbsp;hours.
      </Text>
    </Shell>
  )
}

// ─── Payment receipt ─────────────────────────────────────────

interface PaymentReceiptProps {
  customerName: string
  amount: number
  currency: string
  reference: string
  purpose: string
  date: string
}

function purposeLabel(p: string) {
  return p
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PaymentReceiptEmail({ customerName, amount, currency, reference, purpose, date }: PaymentReceiptProps) {
  return (
    <Shell preview={`Receipt · ${currency} ${amount.toLocaleString()} paid to Omnix`}>
      <Heading
        as="h1"
        style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 500, margin: 0, marginBottom: 12, color: colors.fg }}
      >
        Receipt
      </Heading>
      <Text style={{ fontSize: 14, color: '#444', margin: 0, marginBottom: 16 }}>
        Thanks {customerName}. Your payment was received.
      </Text>
      <Hr style={{ borderColor: colors.border, marginTop: 16, marginBottom: 0 }} />
      <ReceiptRow label="Amount" value={`${currency} ${amount.toLocaleString()}`} mono />
      <ReceiptRow label="For" value={purposeLabel(purpose)} />
      <ReceiptRow label="Reference" value={reference} mono small />
      <ReceiptRow label="Date" value={date} />
      <Hr style={{ borderColor: colors.border, marginTop: 0, marginBottom: 24 }} />
      <Button
        href="https://omnix.co.ke/dashboard"
        style={{
          display: 'inline-block',
          backgroundColor: colors.accent,
          color: '#fff',
          textDecoration: 'none',
          padding: '10px 20px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Open dashboard
      </Button>
    </Shell>
  )
}

function ReceiptRow({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <Section style={{ display: 'block', padding: '8px 0' }}>
      <Text style={{ fontSize: 13, color: colors.fgMuted, margin: 0, display: 'inline-block', width: '40%' }}>{label}</Text>
      <Text
        style={{
          fontSize: small ? 12 : 13,
          color: small ? colors.fgSubtle : colors.fg,
          margin: 0,
          display: 'inline-block',
          width: '60%',
          textAlign: 'right',
          fontFamily: mono ? fontStack.mono : fontStack.body,
        }}
      >
        {value}
      </Text>
    </Section>
  )
}

// ─── Support reply ───────────────────────────────────────────

interface SupportReplyProps {
  ticketSubject: string
  ticketId: string
  body: string
  agentName: string
}

export function SupportReplyEmail({ ticketSubject, ticketId, body, agentName }: SupportReplyProps) {
  return (
    <Shell preview={`Re: ${ticketSubject} (#${ticketId.slice(0, 8)})`}>
      <Heading
        as="h1"
        style={{ fontFamily: fontStack.display, fontSize: 20, fontWeight: 500, margin: 0, marginBottom: 8, color: colors.fg }}
      >
        {ticketSubject}
      </Heading>
      <Text
        style={{
          fontSize: 11,
          color: colors.fgSubtle,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: 0,
          marginBottom: 16,
        }}
      >
        {agentName} · Omnix support
      </Text>
      <Section
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: '#222',
          borderLeft: `3px solid ${colors.border}`,
          paddingLeft: 16,
          margin: '16px 0',
          whiteSpace: 'pre-wrap',
        }}
      >
        <Text style={{ margin: 0, whiteSpace: 'pre-wrap' as const }}>{body}</Text>
      </Section>
      <Button
        href={`https://omnix.co.ke/dashboard/support/${ticketId}`}
        style={{
          display: 'inline-block',
          backgroundColor: colors.accent,
          color: '#fff',
          textDecoration: 'none',
          padding: '10px 20px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        View ticket
      </Button>
    </Shell>
  )
}

// ─── Test diagnostic email ───────────────────────────────────

export function DiagnosticEmail({ from, sentAt }: { from: string; sentAt: string }) {
  return (
    <Shell preview="Resend integration is working">
      <Heading
        as="h1"
        style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 500, margin: 0, marginBottom: 12, color: colors.fg }}
      >
        It works.
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: '#444', margin: 0, marginBottom: 16 }}>
        Your Resend integration is wired correctly.
      </Text>
      <Text style={{ fontSize: 12, color: colors.fgSubtle, margin: 0 }}>
        Sent from <code style={{ fontFamily: fontStack.mono }}>{from}</code> at {sentAt}.
      </Text>
    </Shell>
  )
}
