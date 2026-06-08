import type { CollectionConfig } from 'payload'
import { ownerOnly, ownerOrSupport } from '../access'
import { KE_COUNTIES } from '../lib/ke-counties'
import { renderEmail, sendEmail } from '../lib/emails'

/**
 * Customers — public-facing user accounts.
 *
 * Auth-enabled: customer signs up at /signup, logs in at /login,
 * and lands at /dashboard. Cannot access /admin.
 *
 * Each customer can hold multiple licenses (one per business or branch),
 * many machines (via licenses), and many payments.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
    // Email verification removed — Kenyan SMTP delivery is unreliable and the
    // friction blocks legitimate signups. Customers can log in immediately
    // after signup. We still send a welcome email but it's purely informational
    // (not a verification gate). If we ever need to re-introduce verification,
    // do it as a soft prompt on the dashboard, not a hard login block.
    verify: false,
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000, // 10 min
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'fullName', 'businessName', 'status', 'createdAt'],
    description: 'Customer accounts — anyone with a Omnix license or trial.',
  },
  access: {
    read: ({ req, id }) => {
      if (req.user?.collection === 'users') return true
      // Customer can only read themselves
      if (req.user?.collection === 'customers') {
        return req.user.id === id
      }
      return false
    },
    update: ({ req, id }) => {
      if (req.user?.collection === 'users') {
        return (req.user as unknown as { role?: string }).role === 'owner'
      }
      if (req.user?.collection === 'customers') {
        return req.user.id === id
      }
      return false
    },
    create: () => true, // public sign-up allowed
    delete: ownerOnly,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        const customer = doc as { id: string | number; email?: string; fullName?: string }
        if (!customer.email) return

        // Force-verify the row at creation time so login works immediately
        // (defensive — also covers cases where the collection-level verify
        // flag hasn't propagated to the running deployment yet).
        try {
          await req.payload.update({
            collection: 'customers',
            id: customer.id,
            data: { _verified: true } as never,
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger.error({ err }, 'failed to auto-verify customer')
        }

        // Auto-issue a 30-day trial licence
        try {
          await req.payload.create({
            collection: 'licenses',
            data: {
              customer: customer.id as never,
              tier: 'trial',
              variant: 'pro',
              modules: ['core', 'dawa', 'retail'],
              status: 'trial',
              maxBranches: 5,
              maxMachines: 10,
            },
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger.error({ err }, 'failed to auto-issue trial licence')
        }

        // Welcome email
        try {
          await sendEmail({
            payload: req.payload,
            to: customer.email,
            subject: 'Karibu — your Omnix trial is live',
            html: await renderEmail('Welcome', {
              name: customer.fullName ?? customer.email.split('@')[0] ?? 'there',
            }),
          })
        } catch (err) {
          req.payload.logger.error({ err }, 'failed to send welcome email')
        }
      },
    ],
  },
  fields: [
    // ── Identity ────────────────────────────────────────────────
    {
      name: 'fullName',
      type: 'text',
      required: true,
    },
    {
      name: 'businessName',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "Mama Mary\'s Pharmacy"',
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      admin: {
        description: '+254 7XX XXX XXX',
      },
    },
    {
      name: 'whatsapp',
      type: 'text',
      admin: {
        description: 'Optional second number. Same format as phone.',
      },
    },
    {
      name: 'kraPin',
      type: 'text',
      admin: {
        description: 'Optional but recommended. Letters then digits, e.g. P051234567A.',
      },
    },

    // ── Address ─────────────────────────────────────────────────
    {
      name: 'country',
      type: 'text',
      defaultValue: 'Kenya',
    },
    {
      name: 'county',
      type: 'select',
      options: KE_COUNTIES.map((c) => ({ label: c.label, value: c.value })),
    },
    {
      name: 'town',
      type: 'text',
    },
    {
      name: 'physicalAddress',
      type: 'textarea',
    },

    // ── Business profile ────────────────────────────────────────
    {
      name: 'businessType',
      type: 'select',
      options: [
        { label: 'Pharmacy / Chemist', value: 'pharmacy' },
        { label: 'Mini-mart / Supermarket', value: 'mini_mart' },
        { label: 'General shop / Duka', value: 'duka' },
        { label: 'Restaurant / Hotel', value: 'restaurant' },
        { label: 'Hardware', value: 'hardware' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'employeeCount',
      type: 'select',
      options: [
        { label: 'Just me', value: '1' },
        { label: '2 – 5', value: '2-5' },
        { label: '6 – 15', value: '6-15' },
        { label: '16 – 50', value: '16-50' },
        { label: '50+', value: '50+' },
      ],
    },

    // ── Marketing & consent ────────────────────────────────────
    {
      name: 'howDidYouHear',
      type: 'select',
      options: [
        { label: 'Google search', value: 'google' },
        { label: 'Friend / referral', value: 'friend' },
        { label: 'Social media', value: 'social' },
        { label: 'Reseller / partner', value: 'reseller' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'newsletterOptIn',
      type: 'checkbox',
      defaultValue: true,
    },

    // ── System fields ───────────────────────────────────────────
    {
      name: 'lastSeenAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Updated automatically on dashboard activity.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Banned', value: 'banned' },
      ],
      access: {
        update: ({ req }) => {
          if (req.user?.collection !== 'users') return false
          return (req.user as unknown as { role?: string }).role === 'owner'
        },
      },
    },

    // ── Internal staff notes ────────────────────────────────────
    {
      name: 'internalNotes',
      type: 'richText',
      admin: {
        description: 'Owner-only notes. Never visible to the customer.',
      },
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
