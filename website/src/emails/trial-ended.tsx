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
import { containerStyle, brand, h1, p, hr, footer, dot } from './_shared-styles'

interface Props {
  name: string
}

export function TrialEnded({ name }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your Duka trial ended — pay to keep going</Preview>
      <Body style={{ backgroundColor: '#0B0907', margin: 0, padding: '40px 0' }}>
        <Container style={containerStyle}>
          <Section style={brand}>
            <Heading style={h1}>
              {BRAND_NAME}
              <span style={dot} />
            </Heading>
          </Section>

          <Heading as="h2" style={{ ...h1, fontSize: '24px', marginTop: 32 }}>
            Your trial wrapped up.
          </Heading>
          <Text style={p}>Hi {name},</Text>
          <Text style={p}>
            Your 30-day Duka trial just ended. The desktop app has switched to a soft-locked
            state — you can still see all your data, export, and sign back in once you pay.
          </Text>
          <Text style={p}>
            <strong>One payment of KES 100,000</strong> reactivates everything. No subscription
            ever.
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
              Pay & reactivate →
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Hit a wall during the trial? Reply to this email — we typically fix what's blocking
            you within a day. Refunds are generous, but most customers prefer the fix.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
