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
import { containerStyle, brand, h1, p, hr, footer, dot, accent } from './_shared-styles'

interface Props {
  name: string
  days: number
}

export function MaintenanceEndingSoon({ name, days }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Maintenance renewal in {String(days)} day{days === 1 ? '' : 's'}</Preview>
      <Body style={{ backgroundColor: '#0B0907', margin: 0, padding: '40px 0' }}>
        <Container style={containerStyle}>
          <Section style={brand}>
            <Heading style={h1}>
              {BRAND_NAME}
              <span style={dot} />
            </Heading>
          </Section>

          <Heading as="h2" style={{ ...h1, fontSize: '24px', marginTop: 32 }}>
            Maintenance renews in {days} day{days === 1 ? '' : 's'}.
          </Heading>
          <Text style={p}>Hi {name},</Text>
          <Text style={p}>
            Your Duka maintenance subscription is up for renewal in{' '}
            <span style={accent}>{days} day{days === 1 ? '' : 's'}</span>. Renew to keep
            statutory updates (KRA, NHIF, SHA, NSSF) flowing automatically.
          </Text>
          <Text style={p}>
            <strong>Skipping renewal is fine.</strong> The desktop app keeps working; you'll
            just need to apply statutory rate changes manually. You can renew any time in the
            future to resume automatic updates.
          </Text>

          <Section style={{ marginTop: 28 }}>
            <Link
              href={`${BRAND.url}/dashboard/billing`}
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
              Renew maintenance →
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            We don't auto-charge. Reminders go out 30, 7, and 1 day before renewal. Cancel
            future reminders any time from your dashboard.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
