import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  return await getVariantMetadata('hospitality')
}

export default function HospitalityPage() {
  return <VariantLanding variant="hospitality" />
}
