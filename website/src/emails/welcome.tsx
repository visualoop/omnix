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

interface WelcomeProps {
  name: string
}

export function Welcome({ name }: WelcomeProps) {
  return (
    <Html>
      <Head />
      <Preview>Karibu, {name}. Your free trial is live.</Preview>
      <Body style={{ backgroundColor: '#0B0907', margin: 0, padding: '40px 0' }}>
        <Container style={containerStyle}>
          <Section style={brand}>
            <Heading style={h1}>
              {BRAND_NAME}
              <span style={dot} />
            </Heading>
          </Section>

          <Heading as="h2" style={{ ...h1, fontSize: '28px', marginTop: 32 }}>
            Karibu, {name}.
          </Heading>
          <Text style={p}>
            Your 30-day Omnix trial is live. Every module is unlocked. No card required, no
            surprises.
          </Text>
          <Text style={p}>
            Open your dashboard to grab your licence key and download the desktop installer.
          </Text>

          <Section style={{ marginTop: 28 }}>
            <Link
              href={`${BRAND.url}/dashboard`}
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
              Open dashboard →
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Questions? Reply to this email or WhatsApp the owner — usually answered within an
            hour during Kenyan business hours.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
