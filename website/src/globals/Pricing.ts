import type { GlobalConfig } from 'payload'
import { ownerOnly } from '../access'

/**
 * Pricing — single global instance.
 * Owner edits prices live without redeploying.
 */
export const Pricing: GlobalConfig = {
  slug: 'pricing',
  admin: {
    description: 'Tier prices, add-ons, trial length, and the comparison table.',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'KES',
    },
    {
      name: 'trialDays',
      type: 'number',
      defaultValue: 30,
    },
    {
      name: 'starter',
      type: 'group',
      fields: [
        { name: 'oneTimeFee', type: 'number', defaultValue: 50000 },
        { name: 'maintenanceYearly', type: 'number', defaultValue: 0 },
        { name: 'maxBranches', type: 'number', defaultValue: 1 },
        { name: 'maxMachines', type: 'number', defaultValue: 3 },
        {
          name: 'features',
          type: 'array',
          fields: [{ name: 'item', type: 'text' }],
        },
      ],
    },
    {
      name: 'business',
      type: 'group',
      fields: [
        { name: 'oneTimeFee', type: 'number', defaultValue: 150000 },
        { name: 'maintenanceYearly', type: 'number', defaultValue: 0 },
        { name: 'maxBranches', type: 'number', defaultValue: 5 },
        { name: 'maxMachines', type: 'number', defaultValue: 10 },
        {
          name: 'features',
          type: 'array',
          fields: [{ name: 'item', type: 'text' }],
        },
      ],
    },
    {
      name: 'enterprise',
      type: 'group',
      fields: [
        {
          name: 'priceLabel',
          type: 'text',
          defaultValue: 'Contact us',
          admin: { description: 'String shown instead of a number ("Contact us", "Custom", etc.).' },
        },
        {
          name: 'features',
          type: 'array',
          fields: [{ name: 'item', type: 'text' }],
        },
      ],
    },

    // ── Add-ons ────────────────────────────────────────────────
    { name: 'cloudBackupMonthly', type: 'number', defaultValue: 500 },
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

    // ── Comparison table ───────────────────────────────────────
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
}
