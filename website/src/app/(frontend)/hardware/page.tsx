import type { Metadata } from 'next'
import { VariantLanding, getVariantMetadata } from '@/components/marketing/variant-landing'

export async function generateMetadata(): Promise<Metadata> {
  return await getVariantMetadata('hardware')
}

export default function HardwarePage() {
  return <VariantLanding variant="hardware" />
}
