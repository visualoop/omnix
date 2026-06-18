import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  return await getVariantMetadata('pro')
}

export default function ProPage() {
  return <VariantLanding variant="pro" />
}
