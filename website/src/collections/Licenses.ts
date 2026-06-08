import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { ownerOnly, ownerOrSupport, allowSystem } from '../access'
import { LICENSE_KEY_PREFIX } from '../lib/brand'

/**
 * Per-variant license key prefix. Variant identifies which Omnix binary
 * the license is bound to (Pro accepts any; trade variants only accept
 * their own).
 */
const VARIANT_PREFIX: Record<string, string> = {
  pro: `${LICENSE_KEY_PREFIX}-PRO`,
  dawa: `${LICENSE_KEY_PREFIX}-DAWA`,
  retail: `${LICENSE_KEY_PREFIX}-RETAIL`,
  hospitality: `${LICENSE_KEY_PREFIX}-HOSP`,
  hardware: `${LICENSE_KEY_PREFIX}-HW`,
}

/**
 * License key format: {VARIANT_PREFIX}-XXXX-XXXX-XXXX
 *   e.g. OMNIX-DAWA-9F3K-7TQX-2B4Z
 * 12 random base32 chars (Crockford alphabet, no I/L/O/U) split into 3 groups.
 */
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const groupChars = (s: string, size: number) =>
  s.match(new RegExp(`.{1,${size}}`, 'g'))?.join('-') ?? s

const generateKey = (variant: string = 'pro'): string => {
  const random = Array.from({ length: 12 }, () =>
    BASE32[Math.floor(Math.random() * BASE32.length)],
  ).join('')
  const prefix = VARIANT_PREFIX[variant] ?? VARIANT_PREFIX.pro
  return `${prefix}-${groupChars(random, 4)}`
}

const generateLicenseKeyHook: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data

  const variant = (data.variant as string | undefined) ?? 'pro'

  // Try a few times in case of unique-collision (extremely rare with 32^12 keys).
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateKey(variant)
    const existing = await req.payload.find({
      collection: 'licenses',
      where: { licenseKey: { equals: candidate } },
      limit: 1,
      depth: 0,
    })
    if (existing.totalDocs === 0) {
      data.licenseKey = candidate
      break
    }
  }

  // If trial, set timestamps (Settings global trialDays not available here yet
  // — we hard-default 30 and a later migration can backfill from Settings).
  if (data.tier === 'trial' && !data.trialStartedAt) {
    const now = new Date()
    data.trialStartedAt = now.toISOString()
    data.trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    data.status = data.status ?? 'trial'
  }

  return data
}

export const Licenses: CollectionConfig = {
  slug: 'licenses',
  admin: {
    useAsTitle: 'licenseKey',
    defaultColumns: ['licenseKey', 'customer', 'tier', 'status', 'expiresAt'],
    description: 'License entitlements. One customer can hold many.',
  },
  access: {
    read: ({ req }) => {
      if (req.user?.collection === 'users') return true
      if (req.user?.collection === 'customers') {
        return { customer: { equals: req.user.id } }
      }
      return false
    },
    create: ({ req }) => allowSystem(req) || ownerOnly({ req } as never) === true,
    update: ({ req }) => allowSystem(req) || ownerOnly({ req } as never) === true,
    delete: ownerOnly,
  },
  hooks: {
    beforeChange: [generateLicenseKeyHook],
  },
  fields: [
    {
      name: 'licenseKey',
      type: 'text',
      unique: true,
      admin: {
        description: 'Auto-generated on creation. Format: OMNIX-{VARIANT}-XXXX-XXXX-XXXX. Read-only after create.',
        readOnly: true,
      },
    },
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'pro',
      options: [
        { label: 'Pro — multi-trade (Dawa + Retail + Hospitality + Hardware)', value: 'pro' },
        { label: 'Dawa — Pharmacy', value: 'dawa' },
        { label: 'Retail — Shops, mini-marts', value: 'retail' },
        { label: 'Hospitality — Restaurants, bars, lodges', value: 'hospitality' },
        { label: 'Hardware — Hardware stores', value: 'hardware' },
      ],
      admin: {
        description: 'Which Omnix binary this license activates. Pro accepts any binary; trade variants only accept their matching binary.',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      hasMany: false,
    },

    // ── Entitlement scope ──────────────────────────────────────
    {
      name: 'tier',
      type: 'select',
      required: true,
      defaultValue: 'trial',
      options: [
        { label: 'Trial — 30 days free', value: 'trial' },
        { label: 'Starter — 1 branch', value: 'starter' },
        { label: 'Business — up to 5 branches', value: 'business' },
        { label: 'Enterprise — unlimited', value: 'enterprise' },
      ],
    },
    {
      name: 'modules',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['core'],
      options: [
        { label: 'Core ERP', value: 'core' },
        { label: 'Dawa Pharmacy', value: 'dawa' },
        { label: 'Soko Retail', value: 'retail' },
        { label: 'Hardware & Building Materials', value: 'hardware' },
        { label: 'Hospitality (restaurant + hotel)', value: 'hospitality' },
      ],
    },
    {
      name: 'maxBranches',
      type: 'number',
      defaultValue: 1,
      min: 1,
    },
    {
      name: 'maxMachines',
      type: 'number',
      defaultValue: 3,
      min: 1,
      admin: {
        description: 'Number of PCs that can activate with this license key.',
      },
    },

    // ── Self-service rebind cooldown (anti-reseller) ───────────
    {
      name: 'rebindLimitPerWindow',
      type: 'number',
      defaultValue: 2,
      min: 0,
      admin: {
        description: 'Max self-service machine rebinds allowed within rebindWindowDays. 0 = support-only.',
      },
    },
    {
      name: 'rebindWindowDays',
      type: 'number',
      defaultValue: 30,
      min: 1,
      admin: { description: 'Rolling window (days) over which rebindLimitPerWindow is counted.' },
    },
    {
      name: 'rebindCountInWindow',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Rebinds used in the current window. Reset when the window rolls over.' },
    },
    {
      name: 'rebindWindowStartedAt',
      type: 'date',
      admin: { readOnly: true, description: 'When the current rebind window started.' },
    },

    // ── Lifecycle ──────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'trial',
      options: [
        { label: 'Trial — free, ticking down', value: 'trial' },
        { label: 'Active — paid and current', value: 'active' },
        { label: 'Lapsed — trial ended, awaiting payment', value: 'lapsed' },
        { label: 'Maintenance expired (still on current major)', value: 'maintenance_expired' },
        { label: 'Suspended (refund / abuse)', value: 'suspended' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'trialStartedAt',
      type: 'date',
    },
    {
      name: 'trialEndsAt',
      type: 'date',
    },
    {
      name: 'paidAt',
      type: 'date',
    },
    {
      name: 'maintenanceUntil',
      type: 'date',
      admin: {
        description: 'Last paid maintenance year covers updates up to this date.',
      },
    },
    {
      name: 'majorVersionCap',
      type: 'number',
      defaultValue: 1,
      admin: {
        description: 'Max desktop major version this license can install. Bump when customer pays for major upgrade.',
      },
    },

    // ── Pricing snapshot at purchase time ──────────────────────
    {
      name: 'priceFeePaid',
      type: 'number',
      admin: { description: 'KES one-time fee actually paid (snapshot, not current list price).' },
    },
    {
      name: 'priceMaintenancePaid',
      type: 'number',
      admin: { description: 'KES per-year maintenance paid (snapshot).' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'KES',
    },

    // ── Cloud backup add-on ────────────────────────────────────
    {
      name: 'cloudBackupEnabled',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'cloudBackupExpiresAt',
      type: 'date',
    },

    // ── Audit ──────────────────────────────────────────────────
    {
      name: 'issuedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Empty = system-issued (Paystack webhook). Otherwise the staff member who created it.',
      },
    },
    {
      name: 'internalNotes',
      type: 'richText',
      access: {
        read: ({ req }) =>
          req.user?.collection === 'users' &&
          ['owner', 'support'].includes((req.user as unknown as { role?: string }).role ?? ''),
        update: ({ req }) =>
          req.user?.collection === 'users' &&
          ['owner', 'support'].includes((req.user as unknown as { role?: string }).role ?? ''),
      },
    },
  ],
}
