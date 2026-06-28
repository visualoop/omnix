/**
 * Site settings — typed accessor that reads from platform_settings (DB,
 * admin-editable in /admin/settings → Site category) with sensible
 * code-level defaults so the marketing site never breaks if the admin
 * leaves a value empty.
 *
 * Hot-reloads via the platform-settings 60-second cache.
 */
import { siteBranding } from '@/lib/platform-settings'

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
    facebook: string | null
    youtube: string | null
    instagram: string | null
    github: string | null
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const b = await siteBranding()
    return {
      brandName: 'Omnix',
      tagline: b.tagline,
      kraPin: b.kraPin,
      supportEmail: b.supportEmail,
      salesEmail: b.salesEmail,
      whatsappNumber: b.whatsapp,
      whatsappUrl: b.whatsappUrl,
      whatsappDisplay: b.whatsapp,
      phoneNumber: b.phoneKenya ?? b.phoneIntl,
      office: {
        address: b.addressKenya ?? b.addressIntl,
        mapEmbedUrl: null,
        workingHours: 'Mon–Fri · 8:00–18:00 EAT',
      },
      social: b.social,
    }
  } catch {
    // Fallback if DB is unreachable on cold start.
    return {
      brandName: 'Omnix',
      tagline: 'Offline-first POS + business software for Kenyan SMEs',
      kraPin: null,
      supportEmail: 'support@omnix.co.ke',
      salesEmail: null,
      whatsappNumber: null,
      whatsappUrl: null,
      whatsappDisplay: null,
      phoneNumber: null,
      office: { address: null, mapEmbedUrl: null, workingHours: null },
      social: { twitter: null, linkedin: null, facebook: null, youtube: null, instagram: null, github: null },
    }
  }
}
