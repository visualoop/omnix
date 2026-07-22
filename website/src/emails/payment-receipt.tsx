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
import { containerStyle, brand, h1, p, hr, footer, dot, code } from './_shared-styles'

interface Props {
  name: string
  reference: string
  amount: number
  currency: string
  purpose: string
}

export function PaymentReceipt({ name, reference, amount, currency, purpose }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Receipt {reference} — {currency} {amount.toLocaleString()}</Preview>
      <Body style={{ backgroundColor: '#0B0907', margin: 0, padding: '40px 0' }}>
        <Container style={containerStyle}>
          <Section style={brand}>
            <Heading style={h1}>
              {BRAND_NAME}
              <span style={dot} />
            </Heading>
          </Section>

          <Heading as="h2" style={{ ...h1, fontSize: '24px', marginTop: 32 }}>
            Thanks for the payment.
          </Heading>
          <Text style={p}>Hi {name},</Text>
          <Text style={p}>
            We&apos;ve received {currency} {amount.toLocaleString()} for {purpose.replace(/_/g, ' ')}.
            A formatted receipt is attached at the link below — open it in your browser and
            print to PDF if you need a copy for your books.
          </Text>

          <Section style={{ margin: '16px 0' }}>
            <span style={code}>Reference {reference}</span>
          </Section>

          <Section style={{ marginTop: 28 }}>
            <Link
              href={`${BRAND.url}/dashboard/payments`}
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
              View receipt →
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            All payments are processed by Paystack. Card details never reach our servers. For
            billing queries reply to this email — billing@{BRAND.domain}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
