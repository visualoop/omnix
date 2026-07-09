import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  return await getVariantMetadata('salon')
}

export default function SalonPage() {
  return <VariantLanding variant="salon" />
}
