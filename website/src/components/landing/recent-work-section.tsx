import { VerifiedCustomerProof } from '@/components/marketing/verified-customer-proof'

/** Renders nothing until persisted case-study or logo proof passes every join. */
export function RecentWorkSection() {
  return <VerifiedCustomerProof kinds={['case-study', 'customer-logo']} />
}
