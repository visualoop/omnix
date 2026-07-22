import { VerifiedCustomerProof } from '@/components/marketing/verified-customer-proof'

/** Renders nothing until a persisted testimonial passes every verification join. */
export function ThreeQuotesSection() {
  return <VerifiedCustomerProof kinds={['testimonial']} />
}
