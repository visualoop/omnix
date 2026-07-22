/**
 * Email templates — React Email components with editorial cream-paper
 * design language to match the marketing site.
 *
 * Design choices (per frontend-design skill):
 *
 *   Subject:  transactional email for Kenyan SME owners. Audience reads
 *             on Gmail/Outlook on phones during the workday.
 *
 *   Type:     Georgia (display, with Fraunces-via-Google fallback for
 *             modern clients), Helvetica/Arial body, monospace for
 *             keys + references. Sized down vs marketing — emails get
 *             compressed by clients, so 14px body / 22px display.
 *
 *   Color:    cream paper #FBFAF6 surface, espresso ink #1A1410 text,
 *             copper accent #C77B3F for CTAs + license trim, taupe
 *             #7A6F5C for muted lines, hairline #E5DFD0 for borders.
 *             NO pure white anywhere — paper feel.
 *
 *   Layout:   480px max-width container, 20px vertical padding (Gmail
 *             adds ~20px margins of its own; total reads as 40px),
 *             16-20px horizontal padding inside the card. Letterhead
 *             eyebrow + hairline rule on every email like a piece of
 *             stationery.
 *
 *   Signature: license-key card uses a perforated-ticket motif with a
 *              copper trim down the left edge. Other emails are quiet.
 *
 * Templates exported:
 *   - MagicLinkEmail       sign-in
 *   - WelcomeEmail         first sign-up
 *   - InviteEmail          org invitation
 *   - LicenseKeyEmail      purchase-confirmation with the key
 *   - PaymentReceiptEmail  generic receipt
 *   - PaymentFailedEmail   charge declined
 *   - TrialEndingEmail     7/3/1-day trial reminders
 *   - MaintenanceEndingEmail  renewal reminders
 *   - MaintenanceLapsedEmail  expired
 *   - CloudBackupEndingEmail  S3 backup expires
 *   - SupportReplyEmail    customer-facing support reply
 *   - DiagnosticEmail      admin smoke-test
 */
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text,
} from '@react-email/components'

// ─── Tokens ─────────────────────────────────────────────────────

const c = {
  bg: '#F4F1EA',                  // cream OUTSIDE the card (Gmail's frame)
  surface: '#FBFAF6',             // cream paper INSIDE the card
  surfaceTint: '#F7F2E6',         // tinted band for receipt rows
  fg: '#1A1410',                  // espresso ink
  fgMuted: '#5C5249',             // warm taupe for body
  fgSubtle: '#8A8278',            // mid taupe for footnotes
  accent: '#C77B3F',              // copper
  accentSoft: '#F1E4D6',          // copper wash
  border: '#E5DFD0',              // hairline cream-grey
  borderStrong: '#D5CCB8',
  positive: '#5F7E47',            // moss green for success
  warning: '#B5904A',             // gilded amber for warnings
  negative: '#A33A2C',             // warm clay-red
}

const fonts = {
  body: 'Helvetica, Arial, sans-serif',
  display: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Courier, monospace',
}

interface BrandValues {
  tagline: string
  supportEmail: string
  supportWhatsapp: string | null
  businessAddress: string | null
  legalName: string
  copyright: string
  unsubscribe: string
  brandUrl: string
}

interface ShellProps {
  preview: string
  brand: BrandValues
  children: React.ReactNode
}

/**
 * Shell — letterhead-style frame around every email. Tight padding
 * because Gmail/Outlook add their own outer margins. The letterhead
 * top is a small caps "OMNIX" with a hairline rule + tagline beneath.
 */
function Shell({ preview, brand, children }: ShellProps) {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: c.bg,
          fontFamily: fonts.body,
          color: c.fg,
          margin: 0,
          padding: '24px 12px',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          style={{
            maxWidth: 480,
            margin: '0 auto',
            backgroundColor: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 4,
          }}
        >
          {/* Letterhead — small caps + hairline + tagline */}
          <Section style={{ padding: '20px 24px 14px' }}>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 13,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: c.fg,
                margin: 0,
                fontWeight: 500,
              }}
            >
              Omnix
            </Text>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 11,
                color: c.fgSubtle,
                margin: '4px 0 0',
              }}
            >
              {brand.tagline}
            </Text>
          </Section>
          <Hr style={{ borderColor: c.border, margin: '0 24px', borderTop: `1px solid ${c.border}` }} />

          {/* Main content */}
          <Section style={{ padding: '20px 24px 24px' }}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={{ borderColor: c.border, margin: '0 24px', borderTop: `1px solid ${c.border}` }} />
          <Section style={{ padding: '14px 24px 18px' }}>
            <Text style={{ fontSize: 11, color: c.fgSubtle, margin: 0, lineHeight: 1.55 }}>
              {brand.unsubscribe}
            </Text>
            <Text style={{ fontSize: 11, color: c.fgSubtle, margin: '8px 0 0', lineHeight: 1.55 }}>
              Reply to this email or contact us:&nbsp;
              <Link href={`mailto:${brand.supportEmail}`} style={{ color: c.fgMuted, textDecoration: 'underline' }}>
                {brand.supportEmail}
              </Link>
              {brand.supportWhatsapp && (
                <>
                  {' · '}
                  <Link href={`https://wa.me/${brand.supportWhatsapp.replace(/\D/g, '')}`} style={{ color: c.fgMuted, textDecoration: 'underline' }}>
                    WhatsApp {brand.supportWhatsapp}
                  </Link>
                </>
              )}
            </Text>
            {brand.businessAddress && (
              <Text style={{ fontSize: 10, color: c.fgSubtle, margin: '8px 0 0', lineHeight: 1.55 }}>
                {brand.businessAddress}
              </Text>
            )}
            <Text style={{ fontSize: 10, color: c.fgSubtle, margin: '8px 0 0', lineHeight: 1.55 }}>
              {brand.copyright} · <Link href={brand.brandUrl} style={{ color: c.fgSubtle, textDecoration: 'underline' }}>{brand.brandUrl.replace(/^https?:\/\//, '')}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Common element styles
const headingStyle: React.CSSProperties = {
  fontFamily: fonts.display,
  fontSize: 22,
  fontWeight: 500,
  lineHeight: 1.2,
  color: c.fg,
  margin: 0,
  letterSpacing: '-0.01em',
}
const ledeStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: c.fgMuted,
  margin: '10px 0 18px',
}
const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: c.accent,
  color: '#FBFAF6',
  textDecoration: 'none',
  padding: '10px 20px',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.02em',
}
const eyebrowStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: c.fgSubtle,
  margin: 0,
  fontWeight: 600,
}

// ─── 1. Magic link sign-in ───────────────────────────────────

interface MagicLinkProps {
  url: string
  expiresInMinutes?: number
  brand: BrandValues
}

export function MagicLinkEmail({ url, expiresInMinutes = 15, brand }: MagicLinkProps) {
  return (
    <Shell preview={`Sign in to Omnix · expires in ${expiresInMinutes} min`} brand={brand}>
      <Text style={eyebrowStyle}>Sign-in link</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>One click and you&apos;re in.</Heading>
      <Text style={ledeStyle}>
        Click the button to sign in. The link expires in {expiresInMinutes}&nbsp;minutes
        and can only be used once.
      </Text>
      <Button href={url} style={buttonStyle}>Sign in to Omnix</Button>
      <Text style={{ fontSize: 11, color: c.fgSubtle, margin: '20px 0 0', lineHeight: 1.55 }}>
        Trouble with the button? Paste this URL into your browser:
      </Text>
      <Text style={{ fontSize: 11, fontFamily: fonts.mono, color: c.fgSubtle, margin: '4px 0 0', wordBreak: 'break-all' }}>
        <Link href={url} style={{ color: c.fgSubtle }}>{url}</Link>
      </Text>
      <Text style={{ fontSize: 11, color: c.fgSubtle, margin: '14px 0 0', lineHeight: 1.55 }}>
        Didn&apos;t request this? Ignore the email — no account changes happen until someone clicks the link.
      </Text>
    </Shell>
  )
}

// ─── 2. Welcome (post first sign-up) ─────────────────────────

interface WelcomeProps {
  name: string
  brand: BrandValues
}

export function WelcomeEmail({ name, brand }: WelcomeProps) {
  return (
    <Shell preview={`Welcome to Omnix, ${name}.`} brand={brand}>
      <Text style={eyebrowStyle}>Welcome</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Karibu, <em>{name}</em>.
      </Heading>
      <Text style={ledeStyle}>
        Your Omnix account is set up. Buy a perpetual licence for your trade from the dashboard, or book a demo if you&apos;d like a walkthrough first.
      </Text>
      <Button href={`${brand.brandUrl}/dashboard`} style={buttonStyle}>Open dashboard</Button>
      <Hr style={{ borderColor: c.border, margin: '24px 0' }} />
      <Text style={{ fontSize: 13, color: c.fgMuted, margin: '0 0 6px' }}>
        Three things you can do today:
      </Text>
      <Text style={{ fontSize: 13, color: c.fg, margin: 0, lineHeight: 1.7 }}>
        1. Download the installer for your trade — Dawa, Retail, Hospitality, Hardware, or Salon &amp; Spa<br />
        2. Buy your perpetual licence and activate it on your first machine<br />
        3. Add your team and a second machine if you have one (LAN sync is built-in)
      </Text>
    </Shell>
  )
}

// ─── 3. Org invitation ───────────────────────────────────────

interface InviteProps {
  inviteLink: string
  inviterName: string
  orgName: string
  brand: BrandValues
}

export function InviteEmail({ inviteLink, inviterName, orgName, brand }: InviteProps) {
  return (
    <Shell preview={`${inviterName} invited you to ${orgName} on Omnix`} brand={brand}>
      <Text style={eyebrowStyle}>Invitation</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>{inviterName} added you to {orgName}.</Heading>
      <Text style={ledeStyle}>
        You&apos;ll be a member of <strong>{orgName}</strong> on Omnix once you accept.
        The invitation expires in 48&nbsp;hours.
      </Text>
      <Button href={inviteLink} style={buttonStyle}>Accept invitation</Button>
    </Shell>
  )
}

// ─── 4. License key delivery (purchase confirmation) ────────

interface LicenseKeyProps {
  customerName: string
  licenseKey: string
  variant: string
  amountPaid: number
  currency: string
  reference: string
  date: string
  downloadUrl: string
  maintenanceUntil: string
  brand: BrandValues
}

export function LicenseKeyEmail({
  customerName, licenseKey, variant, amountPaid, currency, reference, date,
  downloadUrl, maintenanceUntil, brand,
}: LicenseKeyProps) {
  return (
    <Shell preview={`Your Omnix licence — ${variant} · ${formatKey(licenseKey)}`} brand={brand}>
      <Text style={eyebrowStyle}>Receipt + Licence</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Thanks, <em>{customerName}</em>. Your licence is ready.
      </Heading>
      <Text style={ledeStyle}>
        Keep this email — it contains your activation key. You can also see it any time at the dashboard.
      </Text>

      {/* The license card — copper trim left, mono key, ticket-style edge */}
      <table
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          margin: '20px 0',
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                width: 6,
                backgroundColor: c.accent,
                borderTopLeftRadius: 4,
                borderBottomLeftRadius: 4,
              }}
            />
            <td
              style={{
                padding: '18px 20px',
                backgroundColor: c.surfaceTint,
                border: `1px solid ${c.border}`,
                borderLeft: 'none',
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: c.fgSubtle, margin: 0 }}>
                Omnix · {variant}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 16,
                  letterSpacing: '0.08em',
                  color: c.fg,
                  margin: '8px 0 12px',
                  wordBreak: 'break-all',
                  fontWeight: 600,
                }}
              >
                {formatKey(licenseKey)}
              </Text>
              <Text style={{ fontSize: 11, color: c.fgMuted, margin: 0, lineHeight: 1.55 }}>
                Maintenance + updates until <strong>{maintenanceUntil}</strong>
              </Text>
            </td>
          </tr>
        </tbody>
      </table>

      <Button href={downloadUrl} style={buttonStyle}>Download Omnix {variant}</Button>

      <Hr style={{ borderColor: c.border, margin: '24px 0 12px' }} />

      {/* Receipt rows */}
      <ReceiptRow label="Amount paid" value={`${currency} ${amountPaid.toLocaleString()}`} mono />
      <ReceiptRow label="Reference"   value={reference} mono small />
      <ReceiptRow label="Date"        value={date} />

      <Hr style={{ borderColor: c.border, margin: '12px 0 16px' }} />

      <Text style={{ fontSize: 12, color: c.fgMuted, margin: 0, lineHeight: 1.6 }}>
        <strong>How to activate:</strong> install Omnix, open it, and paste the licence key
        into the activation screen. The first machine you activate becomes your master device.
      </Text>
    </Shell>
  )
}

// ─── 5. Generic payment receipt ──────────────────────────────

interface PaymentReceiptProps {
  customerName: string
  amount: number
  currency: string
  reference: string
  purpose: string
  date: string
  brand: BrandValues
}

export function PaymentReceiptEmail({
  customerName, amount, currency, reference, purpose, date, brand,
}: PaymentReceiptProps) {
  const purposeLabel = purpose.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
  return (
    <Shell preview={`Receipt · ${currency} ${amount.toLocaleString()} paid to Omnix`} brand={brand}>
      <Text style={eyebrowStyle}>Receipt</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>Payment received.</Heading>
      <Text style={ledeStyle}>Thanks {customerName}. We&apos;ve recorded your payment.</Text>

      <Hr style={{ borderColor: c.border, margin: '16px 0 0' }} />
      <ReceiptRow label="Amount"    value={`${currency} ${amount.toLocaleString()}`} mono />
      <ReceiptRow label="For"       value={purposeLabel} />
      <ReceiptRow label="Reference" value={reference} mono small />
      <ReceiptRow label="Date"      value={date} />
      <Hr style={{ borderColor: c.border, margin: '0 0 16px' }} />

      <Button href={`${brand.brandUrl}/dashboard/payments`} style={buttonStyle}>Open dashboard</Button>
    </Shell>
  )
}

// ─── 6. Payment failed ───────────────────────────────────────

interface PaymentFailedProps {
  customerName: string
  amount: number
  currency: string
  reference: string
  purpose: string
  reason: string
  retryUrl: string
  brand: BrandValues
}

export function PaymentFailedEmail({
  customerName, amount, currency, reference, purpose, reason, retryUrl, brand,
}: PaymentFailedProps) {
  return (
    <Shell preview={`Payment didn't go through · ${currency} ${amount.toLocaleString()}`} brand={brand}>
      <Text style={eyebrowStyle}>Payment failed</Text>
      <Heading style={{ ...headingStyle, marginTop: 6, color: c.negative }}>
        We couldn&apos;t complete your payment.
      </Heading>
      <Text style={ledeStyle}>
        Hi {customerName} — your card or M-Pesa charge for <strong>{currency} {amount.toLocaleString()}</strong> didn&apos;t go through.
      </Text>

      <Hr style={{ borderColor: c.border, margin: '16px 0 0' }} />
      <ReceiptRow label="Amount"    value={`${currency} ${amount.toLocaleString()}`} mono />
      <ReceiptRow label="For"       value={purpose.replace(/_/g, ' ')} />
      <ReceiptRow label="Reason"    value={reason} />
      <ReceiptRow label="Reference" value={reference} mono small />
      <Hr style={{ borderColor: c.border, margin: '0 0 16px' }} />

      <Button href={retryUrl} style={buttonStyle}>Retry payment</Button>
      <Text style={{ fontSize: 12, color: c.fgMuted, margin: '14px 0 0', lineHeight: 1.55 }}>
        If retries keep failing, reply to this email and we&apos;ll sort it manually.
      </Text>
    </Shell>
  )
}

// ─── 7. Trial ending ─────────────────────────────────────────

interface TrialEndingProps {
  customerName: string
  variant: string
  daysLeft: number
  buyUrl: string
  brand: BrandValues
}

export function TrialEndingEmail({ customerName, variant, daysLeft, buyUrl, brand }: TrialEndingProps) {
  const tone = daysLeft <= 1 ? c.negative : daysLeft <= 3 ? c.warning : c.fgMuted
  return (
    <Shell preview={`Your ${variant} trial ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`} brand={brand}>
      <Text style={eyebrowStyle}>Trial reminder</Text>
      <Heading style={{ ...headingStyle, marginTop: 6, color: tone }}>
        {daysLeft === 0 ? 'Your trial ends today.' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left on your trial.`}
      </Heading>
      <Text style={ledeStyle}>
        Hi {customerName} — your <strong>{variant}</strong> trial expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
        Buy a licence now to keep working without interruption. Same machine, same data, same login.
      </Text>
      <Button href={buyUrl} style={buttonStyle}>Buy {variant} licence</Button>
      <Text style={{ fontSize: 12, color: c.fgMuted, margin: '14px 0 0', lineHeight: 1.55 }}>
        Need more time or have questions? Reply to this email.
      </Text>
    </Shell>
  )
}

// ─── 8. Maintenance ending soon ──────────────────────────────

interface MaintenanceEndingProps {
  customerName: string
  variant: string
  daysLeft: number
  expiresOn: string
  renewUrl: string
  brand: BrandValues
}

export function MaintenanceEndingEmail({
  customerName, variant, daysLeft, expiresOn, renewUrl, brand,
}: MaintenanceEndingProps) {
  return (
    <Shell preview={`Maintenance for ${variant} expires in ${daysLeft} days`} brand={brand}>
      <Text style={eyebrowStyle}>Maintenance reminder</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Renewal is due in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
      </Heading>
      <Text style={ledeStyle}>
        Hi {customerName} — your maintenance + updates plan for <strong>{variant}</strong> ends on <strong>{expiresOn}</strong>.
        Renew to keep getting eTIMS + SHA compliance updates and the latest features.
      </Text>
      <Button href={renewUrl} style={buttonStyle}>Renew maintenance</Button>
      <Text style={{ fontSize: 12, color: c.fgMuted, margin: '14px 0 0', lineHeight: 1.55 }}>
        After expiry, the app keeps running but stops receiving updates.
      </Text>
    </Shell>
  )
}

// ─── 9. Maintenance lapsed ───────────────────────────────────

interface MaintenanceLapsedProps {
  customerName: string
  variant: string
  expiredOn: string
  renewUrl: string
  brand: BrandValues
}

export function MaintenanceLapsedEmail({
  customerName, variant, expiredOn, renewUrl, brand,
}: MaintenanceLapsedProps) {
  return (
    <Shell preview={`Maintenance for ${variant} has expired`} brand={brand}>
      <Text style={eyebrowStyle}>Maintenance expired</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Your maintenance plan lapsed on {expiredOn}.
      </Heading>
      <Text style={ledeStyle}>
        Hi {customerName} — Omnix {variant} keeps working, but it stopped receiving updates on {expiredOn}.
        That includes eTIMS rule changes and SHA payer updates. Renew at any time to catch up.
      </Text>
      <Button href={renewUrl} style={buttonStyle}>Renew now</Button>
    </Shell>
  )
}

// ─── 10. Cloud backup ending ─────────────────────────────────

interface CloudBackupEndingProps {
  customerName: string
  daysLeft: number
  expiresOn: string
  renewUrl: string
  brand: BrandValues
}

export function CloudBackupEndingEmail({
  customerName, daysLeft, expiresOn, renewUrl, brand,
}: CloudBackupEndingProps) {
  return (
    <Shell preview={`Cloud backup expires in ${daysLeft} days`} brand={brand}>
      <Text style={eyebrowStyle}>Cloud backup</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Cloud backup ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
      </Heading>
      <Text style={ledeStyle}>
        Hi {customerName} — your cloud-backup add-on ends on <strong>{expiresOn}</strong>.
        Without it, backups stay local-only. Top up to keep encrypted off-site copies running.
      </Text>
      <Button href={renewUrl} style={buttonStyle}>Renew cloud backup</Button>
    </Shell>
  )
}

// ─── 11. Support reply ───────────────────────────────────────

interface SupportReplyProps {
  ticketSubject: string
  ticketId: string
  body: string
  agentName: string
  brand: BrandValues
}

export function SupportReplyEmail({ ticketSubject, ticketId, body, agentName, brand }: SupportReplyProps) {
  return (
    <Shell preview={`Re: ${ticketSubject}`} brand={brand}>
      <Text style={eyebrowStyle}>Support reply</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>{ticketSubject}</Heading>
      <Text style={{ fontSize: 11, color: c.fgSubtle, margin: '6px 0 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {agentName} · Omnix support
      </Text>
      <Section
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: c.fg,
          borderLeft: `3px solid ${c.borderStrong}`,
          paddingLeft: 14,
          margin: '0 0 16px',
        }}
      >
        <Text style={{ margin: 0, whiteSpace: 'pre-wrap' as const }}>{body}</Text>
      </Section>
      <Button href={`${brand.brandUrl}/dashboard/support/${ticketId}`} style={buttonStyle}>View ticket</Button>
    </Shell>
  )
}

// ─── 12. Diagnostic ─────────────────────────────────────────

export function DiagnosticEmail({ from, sentAt, brand }: { from: string; sentAt: string; brand: BrandValues }) {
  return (
    <Shell preview="Resend integration is working" brand={brand}>
      <Text style={eyebrowStyle}>Diagnostic</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>It works.</Heading>
      <Text style={ledeStyle}>Resend is wired correctly. This email rendered through the React Email pipeline.</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: c.fgSubtle, margin: 0 }}>
        from: {from}<br />
        sent: {sentAt}
      </Text>
    </Shell>
  )
}

// ─── 13. Team invite (staff onboarding) ─────────────────────

interface TeamInviteProps {
  inviterName: string
  inviteeName: string
  role: string
  signInUrl: string
  brand: BrandValues
}

const ROLE_HUMAN: Record<string, string> = {
  platform_admin: 'Platform admin — full access to every page in the operator console',
  support_agent: 'Support agent — can read users + reply to tickets',
  sales_rep: 'Sales rep — can read customers + payments + licences',
}

export function TeamInviteEmail({ inviterName, inviteeName, role, signInUrl, brand }: TeamInviteProps) {
  return (
    <Shell preview={`${inviterName} added you to the Omnix team as ${role.replace('_', ' ')}`} brand={brand}>
      <Text style={eyebrowStyle}>Team invite</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        {inviterName} added you to the Omnix team.
      </Heading>
      <Text style={ledeStyle}>
        Hi {inviteeName} — your account is set up with the role below. Click the
        button to sign in. The link expires in 15&nbsp;minutes.
      </Text>

      <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0 18px' }}>
        <tbody>
          <tr>
            <td
              style={{
                padding: '12px 14px',
                backgroundColor: c.surfaceTint,
                border: `1px solid ${c.border}`,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: c.fgSubtle, margin: 0 }}>
                Role
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: c.fg, margin: '4px 0 4px', fontWeight: 500 }}>
                {role.replace('_', ' ')}
              </Text>
              <Text style={{ fontSize: 12, color: c.fgMuted, margin: 0, lineHeight: 1.5 }}>
                {ROLE_HUMAN[role] ?? 'Custom role.'}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>

      <Button href={signInUrl} style={buttonStyle}>Sign in to Omnix</Button>
      <Text style={{ fontSize: 11, color: c.fgSubtle, margin: '20px 0 0', lineHeight: 1.55 }}>
        We use magic-link sign-in — no passwords. Same link works from any device.
      </Text>
    </Shell>
  )
}

// ─── Receipt-row helper ─────────────────────────────────────

function ReceiptRow({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ padding: '8px 0', fontSize: 12, color: c.fgMuted, width: '40%' }}>{label}</td>
          <td
            style={{
              padding: '8px 0',
              fontSize: small ? 11 : 13,
              color: small ? c.fgSubtle : c.fg,
              fontFamily: mono ? fonts.mono : fonts.body,
              textAlign: 'right',
              width: '60%',
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function formatKey(key: string): string {
  if (!key) return '—'
  if (/^OMNIX-/i.test(key)) return key.toUpperCase()
  const compact = key.replace(/[-\s]/g, '').toUpperCase()
  if (compact.length <= 4) return compact
  return compact.match(/.{1,4}/g)?.join('-') ?? compact
}

// ─── Partnership / reseller enquiry (notification to ops team) ────

interface PartnershipNotifyProps {
  /** Submitter's full name. */
  fullName: string;
  /** Business / organisation. */
  organization: string;
  /** Contact email reply-to. */
  email: string;
  /** Phone / WhatsApp number. */
  phone: string;
  /** Country or region. */
  country: string;
  /** Type of partnership — reseller / OEM / referral / other. */
  interest: "reseller" | "referral" | "oem" | "integration" | "other";
  /** Free-text message. */
  message: string;
  brand: BrandValues;
}

/**
 * Internal notification sent to the partnerships inbox whenever someone
 * submits the /partners form. Plain-letter format because the recipient
 * is a human at Omnix, not a customer.
 */
export function PartnershipInquiryEmail({
  fullName, organization, email, phone, country, interest, message, brand,
}: PartnershipNotifyProps) {
  return (
    <Shell preview={`Partnership enquiry from ${organization}`} brand={brand}>
      <Text style={eyebrowStyle}>Partnership enquiry</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        New {interest} enquiry from {organization}.
      </Heading>
      <Text style={ledeStyle}>
        {fullName} ({country}) submitted the partners form on www.omnix.co.ke.
      </Text>
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 13, color: c.fg, margin: 0, lineHeight: 1.8 }}>
        <strong>Name:</strong> {fullName}<br />
        <strong>Organisation:</strong> {organization}<br />
        <strong>Email:</strong> <Link href={`mailto:${email}`} style={{ color: c.fg }}>{email}</Link><br />
        <strong>Phone:</strong> {phone}<br />
        <strong>Country:</strong> {country}<br />
        <strong>Interest:</strong> {interest}
      </Text>
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 13, color: c.fgMuted, margin: '0 0 6px' }}>Message</Text>
      <Text style={{ fontSize: 14, color: c.fg, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {message}
      </Text>
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 12, color: c.fgSubtle, margin: 0 }}>
        Reply directly to this email to respond — the reply-to is set to the
        submitter&apos;s address.
      </Text>
    </Shell>
  );
}

/**
 * Auto-acknowledgement returned to the submitter — confirms we received
 * their enquiry and sets expectations for response time.
 */
interface PartnershipAckProps {
  fullName: string;
  organization: string;
  brand: BrandValues;
}
export function PartnershipAckEmail({ fullName, organization, brand }: PartnershipAckProps) {
  return (
    <Shell preview="We received your partnership enquiry" brand={brand}>
      <Text style={eyebrowStyle}>Confirmation</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Asante, {fullName}.
      </Heading>
      <Text style={ledeStyle}>
        We received your partnership enquiry for {organization}. The Omnix team
        will assess the details and follow up by email.
      </Text>
      <Text style={{ fontSize: 13, color: c.fgMuted, margin: '14px 0 0', lineHeight: 1.6 }}>
        Omnix is private, commercial software — resellers, integrators and
        regional distributors work with us under a written agreement. If you
        included specific scope or volume in your message, the reply will
        address it directly.
      </Text>
      <Hr style={{ borderColor: c.border, margin: '24px 0' }} />
      <Text style={{ fontSize: 12, color: c.fgSubtle, margin: 0 }}>
        Reply to this email if anything is urgent.
      </Text>
    </Shell>
  );
}


// ─── Demo booking request ─────────────────────────────────────────

interface DemoRequestEmailProps {
  reference: string
  fullName: string
  businessName: string
  workEmail: string
  phone: string
  product: 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'
  locationCount: number
  currentSystem?: string
  priorities: string[]
  notes?: string
  preferredChannel: 'whatsapp' | 'phone' | 'email'
  preferredWindow: 'morning' | 'afternoon' | 'evening' | 'anytime'
  brand: BrandValues
}

const productLabels: Record<DemoRequestEmailProps['product'], string> = {
  pharmacy: 'Pharmacy',
  retail: 'Retail',
  hospitality: 'Hospitality',
  hardware: 'Hardware & Equipment',
  salon: 'Salon & Spa',
}

export function DemoRequestNotificationEmail(props: DemoRequestEmailProps) {
  return (
    <Shell preview={`Demo request from ${props.businessName}`} brand={props.brand}>
      <Text style={eyebrowStyle}>Demo request · {props.reference}</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        {props.businessName} wants to see Omnix {productLabels[props.product]}.
      </Heading>
      <Text style={ledeStyle}>
        {props.fullName} asked to be contacted by {props.preferredChannel} during the {props.preferredWindow} window.
      </Text>
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 13, color: c.fg, margin: 0, lineHeight: 1.8 }}>
        <strong>Name:</strong> {props.fullName}<br />
        <strong>Business:</strong> {props.businessName}<br />
        <strong>Email:</strong> <Link href={`mailto:${props.workEmail}`} style={{ color: c.fg }}>{props.workEmail}</Link><br />
        <strong>Phone:</strong> {props.phone}<br />
        <strong>Product:</strong> {productLabels[props.product]}<br />
        <strong>Locations:</strong> {props.locationCount}<br />
        <strong>Current setup:</strong> {props.currentSystem || 'Not provided'}<br />
        <strong>Priorities:</strong> {props.priorities.length > 0 ? props.priorities.join(', ') : 'Not provided'}
      </Text>
      {props.notes ? (
        <>
          <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
          <Text style={{ fontSize: 13, color: c.fgMuted, margin: '0 0 6px' }}>Notes</Text>
          <Text style={{ fontSize: 14, color: c.fg, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {props.notes}
          </Text>
        </>
      ) : null}
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 12, color: c.fgSubtle, margin: 0 }}>
        Reply directly to this email to contact {props.fullName}.
      </Text>
    </Shell>
  )
}

export function DemoRequestAcknowledgementEmail(props: DemoRequestEmailProps) {
  return (
    <Shell preview="Your Omnix demo request is recorded" brand={props.brand}>
      <Text style={eyebrowStyle}>Demo request · {props.reference}</Text>
      <Heading style={{ ...headingStyle, marginTop: 6 }}>
        Your request is recorded, {props.fullName}.
      </Heading>
      <Text style={ledeStyle}>
        We received the request for {props.businessName}. A member of the Omnix team will use {props.preferredChannel} to confirm a suitable demo time.
      </Text>
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 13, color: c.fgMuted, margin: 0, lineHeight: 1.7 }}>
        The session will focus on {productLabels[props.product]} workflows and the priorities you selected. Keep reference <strong>{props.reference}</strong> if you need to update the request.
      </Text>
      <Hr style={{ borderColor: c.border, margin: '20px 0' }} />
      <Text style={{ fontSize: 12, color: c.fgSubtle, margin: 0 }}>
        Reply to this email if any detail changes before the demo.
      </Text>
    </Shell>
  )
}
