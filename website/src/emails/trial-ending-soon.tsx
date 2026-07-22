import {
  Body,
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
import { BRAND_NAME, BRAND } from '@/lib/brand'
import { pricing } from '@/config/pricing'
import { containerStyle, brand, h1, p, hr, footer, dot, accent } from './_shared-styles'

// Price is derived from the single source of truth in config, never hardcoded,
// so this template can never drift from the published starter licence figure.
const LICENCE_PRICE = `KES ${pricing.starter.oneTimeFee.KES.toLocaleString('en-US')}`
const COMPLIANCE_PRICE = `KES ${pricing.starter.maintenanceYearly.KES.toLocaleString('en-US')}`

interface Props {
  name: string
  days: number
}

/**
 * Trial reminder — retained ONLY to service existing legacy trial records.
 * The public site no longer starts trials, so this template must not be wired
 * to any new public trial-start CTA or lifecycle path.
 */
export function TrialEndingSoon({ name, days }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your Omnix trial ends in {String(days)} day{days === 1 ? '' : 's'}</Preview>
      <Body style={{ backgroundColor: '#0B0907', margin: 0, padding: '40px 0' }}>
        <Container style={containerStyle}>
          <Section style={brand}>
            <Heading style={h1}>
              {BRAND_NAME}
              <span style={dot} />
            </Heading>
          </Section>

          <Heading as="h2" style={{ ...h1, fontSize: '24px', marginTop: 32 }}>
            {days === 1 ? 'Your trial ends tomorrow.' : `Your trial ends in ${days} days.`}
          </Heading>
          <Text style={p}>Hi {name},</Text>
          <Text style={p}>
            Your free Omnix trial wraps up{' '}
            <span style={accent}>
              in {days} day{days === 1 ? '' : 's'}
            </span>
            . One payment of <strong>{LICENCE_PRICE}</strong> keeps it — a one-time,
            perpetual per-device licence, not a subscription. Your data stays exactly where it
            is.
          </Text>
          <Text style={p}>
            Annual compliance updates ({COMPLIANCE_PRICE}/year) are optional and billed
            separately. The perpetual licence keeps working whether or not you renew them.
          </Text>

          <Section style={{ marginTop: 28 }}>
            <Link
              href={`${BRAND.url}/dashboard/licenses`}
              style={{
                background: '#C77B3F',
                color: '#0B0907',
                padding: '12px 22px',
                textDecoration: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Pay now →
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            If Omnix isn&apos;t the right fit, your data exports from the desktop app at any
            time. Reply to this email with any questions.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
