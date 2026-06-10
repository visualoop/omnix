import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  return await getVariantMetadata('retail')
}

export default function RetailPage() {
  return <VariantLanding variant="retail" />
}
