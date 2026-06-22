/**
 * Site settings — typed constants. Was a Payload global; now lives in code.
 *
 * Edit this file to change brand copy, contact info, social links. Edits
 * ship via PR, just like product code. This is intentional — the previous
 * CMS-edit workflow let typos in copy ship without review.
 */

export interface SiteSettings {
  brandName: string
  tagline: string
  kraPin: string | null
  supportEmail: string
  salesEmail: string | null
  whatsappNumber: string | null
  whatsappUrl: string | null
  whatsappDisplay: string | null
  phoneNumber: string | null
  office: {
    address: string | null
    mapEmbedUrl: string | null
    workingHours: string | null
  }
  social: {
    twitter: string | null
    linkedin: string | null
    youtube: string | null
    github: string | null
  }
}

const SITE_SETTINGS: SiteSettings = {
  brandName: 'Omnix',
  tagline: 'Offline-first ERP for Kenyan SMEs',
  kraPin: null,
  supportEmail: 'support@omnix.co.ke',
  salesEmail: 'sales@omnix.co.ke',
  whatsappNumber: '+254712345678',
  whatsappUrl: 'https://wa.me/254712345678',
  whatsappDisplay: '+254 712 345 678',
  phoneNumber: '+254 712 345 678',
  office: {
    address: 'Nairobi, Kenya',
    mapEmbedUrl: null,
    workingHours: 'Mon–Fri · 8:00–18:00 EAT',
  },
  social: {
    twitter: 'https://twitter.com/omnixerp',
    linkedin: 'https://linkedin.com/company/omnix',
    youtube: null,
    github: 'https://github.com/visualoop/omnix',
  },
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return SITE_SETTINGS
}
