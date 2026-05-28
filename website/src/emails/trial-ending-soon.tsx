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

export function TrialEndingSoon({ name, days }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your Duka trial ends in {String(days)} day{days === 1 ? '' : 's'}</Preview>
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
            Your free Duka trial wraps up{' '}
            <span style={accent}>
              in {days} day{days === 1 ? '' : 's'}
            </span>
            . Pay <strong>KES 100,000 once</strong> to keep going — your data stays exactly where
            it is.
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
            If you've already decided Duka isn't the right fit, no worries — your data exports
            from the desktop app at any time. Reply to this email if anything's stopping you
            from paying; we usually fix the issue and you decide later.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
