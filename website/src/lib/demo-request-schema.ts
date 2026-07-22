import { z } from 'zod'

const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const shortOptional = z.string().trim().max(160).optional()

export const DemoRequestBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  workEmail: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(40),
  businessName: z.string().trim().min(2).max(160),
  product: z.enum(['pharmacy', 'retail', 'hospitality', 'hardware', 'salon']),
  locationCount: z.coerce.number().int().min(1).max(250),
  currentSystem: z.string().trim().max(160).optional(),
  priorities: z.array(z.enum([
    'pos',
    'inventory',
    'mpesa',
    'etims',
    'migration',
    'reporting',
    'multi-location',
    'pharmacy-workflows',
    'hospitality-workflows',
    'salon-workflows',
  ])).max(6).default([]),
  notes: z.string().trim().max(2000).optional(),
  preferredChannel: z.enum(['whatsapp', 'phone', 'email']),
  preferredWindow: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
  locale: z.string().trim().regex(/^[a-z]{2}$/).default('ke'),
  sourcePath: z.string().trim().startsWith('/').max(300),
  referrer: z.string().trim().url().max(500).optional().or(z.literal('')),
  attribution: z.object(Object.fromEntries(
    ATTRIBUTION_KEYS.map((key) => [key, shortOptional]),
  ) as Record<(typeof ATTRIBUTION_KEYS)[number], typeof shortOptional>).strict().default({}),
  marketingOptIn: z.boolean().default(false),
  website: z.string().max(200).optional(),
}).strict()

export type DemoRequestInput = z.infer<typeof DemoRequestBody>
