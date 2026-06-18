import type { GlobalConfig, Field } from 'payload'
import { ownerOnly } from '../access'

/**
 * Pricing — single global instance.
 *
 * Multi-currency: every tier carries one price per currency Paystack
 * supports natively (KES, USD, NGN, GHS, ZAR). The website picks the
 * right currency based on the visitor's geo at request time. No
 * exchange-rate API — the owner sets explicit prices per market.
 *
 * Backward-compat: `oneTimeFee` (was KES-only) is kept as a fallback
 * for code paths still reading the legacy single-price field. When a
 * `priceKES` value is set, it takes precedence; otherwise `oneTimeFee`
 * is used as the KES value.
 */

const priceFields: Field[] = [
  { name: 'priceKES', type: 'number', label: 'KES (Kenyan Shilling)', admin: { description: 'Default Kenyan price.' } },
  { name: 'priceUSD', type: 'number', label: 'USD (US Dollar)', admin: { description: 'Used for visitors outside Paystack-native countries.' } },
  { name: 'priceNGN', type: 'number', label: 'NGN (Nigerian Naira)' },
  { name: 'priceGHS', type: 'number', label: 'GHS (Ghanaian Cedi)' },
  { name: 'priceZAR', type: 'number', label: 'ZAR (South African Rand)' },
]

const tierFields = (defaultKES: number, defaultBranches: number, defaultMachines: number): Field[] => [
  {
    name: 'oneTimeFee',
    type: 'number',
    defaultValue: defaultKES,
    admin: { description: 'Legacy single-price field. Use Prices tab for new multi-currency setup.' },
  },
  { name: 'maintenanceYearly', type: 'number', defaultValue: 0 },
  { name: 'maxBranches', type: 'number', defaultValue: defaultBranches },
  { name: 'maxMachines', type: 'number', defaultValue: defaultMachines },
  ...priceFields,
  {
    name: 'features',
    type: 'array',
    fields: [{ name: 'item', type: 'text' }],
  },
]

export const Pricing: GlobalConfig = {
  slug: 'pricing',
  admin: {
    description:
      'Tier prices per currency (KES / USD / NGN / GHS / ZAR), add-ons, trial length, comparison table. Tabs separate the tiers.',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'currency', type: 'text', defaultValue: 'KES', admin: { description: 'Default currency code when geo is unknown.' } },
            { name: 'trialDays', type: 'number', defaultValue: 30 },
          ],
        },
        {
          label: 'Starter',
          description: 'Per-trade variants (Dawa / Retail / Hospitality / Hardware). Default KES 50,000.',
          fields: [
            {
              name: 'starter',
              type: 'group',
              fields: tierFields(50_000, 1, 3),
            },
          ],
        },
        {
          label: 'Business (Pro)',
          description: 'Multi-trade Pro tier. Default KES 150,000.',
          fields: [
            {
              name: 'business',
              type: 'group',
              fields: tierFields(150_000, 5, 10),
            },
          ],
        },
        {
          label: 'Enterprise',
          description: 'Custom-priced — string label shown instead of a number.',
          fields: [
            {
              name: 'enterprise',
              type: 'group',
              fields: [
                {
                  name: 'priceLabel',
                  type: 'text',
                  defaultValue: 'Contact us',
                  admin: { description: 'Text shown in place of a price ("Contact us", "Custom", etc.).' },
                },
                {
                  name: 'features',
                  type: 'array',
                  fields: [{ name: 'item', type: 'text' }],
                },
              ],
            },
          ],
        },
        {
          label: 'Add-ons',
          fields: [
            { name: 'cloudBackupMonthly', type: 'number', defaultValue: 500, admin: { description: 'KES per branch per month.' } },
            { name: 'extraBranchOneTime', type: 'number', defaultValue: 15000 },
            { name: 'extraMachineOneTime', type: 'number', defaultValue: 5000 },
            {
              name: 'majorUpgradeDiscount',
              type: 'number',
              defaultValue: 50,
              min: 0,
              max: 100,
              admin: { description: 'Percent off the new major version fee for existing license holders.' },
            },
          ],
        },
        {
          label: 'Comparison',
          description: 'Per-feature table on the /pricing page.',
          fields: [
            {
              name: 'compareTable',
              type: 'array',
              labels: { singular: 'Feature row', plural: 'Feature rows' },
              fields: [
                { name: 'feature', type: 'text' },
                { name: 'starter', type: 'text', admin: { description: '"✓", "✗", "1 branch" — free-text cell.' } },
                { name: 'business', type: 'text' },
                { name: 'enterprise', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
