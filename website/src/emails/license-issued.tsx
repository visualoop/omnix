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
import { containerStyle, brand, h1, p, hr, footer, dot, code, accent } from './_shared-styles'

interface Props {
  name: string
  licenseKey: string
  tier: string
  maintenanceUntil: string
}

export function LicenseIssued({ name, licenseKey, tier, maintenanceUntil }: Props) {
  const formattedUntil = new Date(maintenanceUntil).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return (
    <Html>
      <Head />
      <Preview>Your Omnix licence is active — {licenseKey}</Preview>
      <Body style={{ backgroundColor: '#0B0907', margin: 0, padding: '40px 0' }}>
        <Container style={containerStyle}>
          <Section style={brand}>
            <Heading style={h1}>
              {BRAND_NAME}
              <span style={dot} />
            </Heading>
          </Section>

          <Heading as="h2" style={{ ...h1, fontSize: '26px', marginTop: 32 }}>
            Welcome aboard, {name}.
          </Heading>
          <Text style={p}>
            Your Omnix licence is active. Paste the key below into the desktop app on first
            launch — it auto-fills if you sign in to your dashboard first.
          </Text>

          <Section style={{ margin: '20px 0' }}>
            <span style={code}>{licenseKey}</span>
          </Section>

          <Text style={p}>
            <strong style={accent}>Tier:</strong> {tier}
            <br />
            <strong style={accent}>Maintenance until:</strong> {formattedUntil}
          </Text>

          <Section style={{ marginTop: 28 }}>
            <Link
              href={`${BRAND.url}/dashboard/downloads`}
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
              Download Omnix →
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Read the first-sale guide at{' '}
            <Link href={`${BRAND.url}/docs/first-pos-sale`} style={accent}>
              {BRAND.domain}/docs/first-pos-sale
            </Link>{' '}
            — five minutes from install to KRA-receipted sale.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
