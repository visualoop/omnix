import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  return await getVariantMetadata('dawa')
}

export default function DawaPage() {
  return <VariantLanding variant="dawa" />
}
