import type { CollectionConfig } from 'payload'
import { ownerOnly } from '../access'

/**
 * Modules — the marketable verticals on the website.
 *
 * Owner can add a new module page (Hardware, Salon, etc.) without
 * code changes. Each entry powers /modules/[slug] + the module bento
 * on the landing page.
 */
export const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'moduleId', 'available', 'priority'],
  },
  access: {
    read: () => true,
    create: ownerOnly,
    update: ownerOnly,
    delete: ownerOnly,
  },
  fields: [
    {
      name: 'moduleId',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'Core ERP', value: 'core' },
        { label: 'Dawa Pharmacy', value: 'dawa' },
        { label: 'Soko Retail', value: 'retail' },
        { label: 'Salon', value: 'salon' },
        { label: 'Restaurant', value: 'restaurant' },
        { label: 'Hardware', value: 'hardware' },
        { label: 'Electronics', value: 'electronics' },
      ],
    },
    { name: 'name', type: 'text', required: true, admin: { description: 'Display name, e.g. "Dawa Pharmacy".' } },
    { name: 'shortName', type: 'text', required: true, admin: { description: 'e.g. "Dawa". Used on cards.' } },
    {
      name: 'tagline',
      type: 'text',
      required: true,
      admin: { description: 'e.g. "Run your pharmacy. Calm and compliant."' },
    },
    {
      name: 'available',
      type: 'select',
      defaultValue: 'planned',
      options: [
        { label: 'Live', value: 'live' },
        { label: 'Beta', value: 'beta' },
        { label: 'Planned', value: 'planned' },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 100,
      admin: { description: 'Lower number sorts first on /modules.' },
    },
    {
      name: 'gradient',
      type: 'select',
      options: [
        { label: 'Amber', value: 'amber' },
        { label: 'Teal', value: 'teal' },
        { label: 'Orange', value: 'orange' },
        { label: 'Blue', value: 'blue' },
        { label: 'Pink', value: 'pink' },
      ],
    },
    { name: 'shortDescription', type: 'textarea', required: true },
    { name: 'longDescription', type: 'richText' },
    {
      name: 'features',
      type: 'array',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'icon', type: 'text', admin: { description: 'Lucide icon name.' } },
        { name: 'screenshot', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'screenshots',
      type: 'array',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'targetCustomers',
      type: 'array',
      fields: [{ name: 'label', type: 'text' }],
    },
    {
      name: 'compliance',
      type: 'array',
      fields: [{ name: 'item', type: 'text' }],
    },
    {
      name: 'pricing',
      type: 'group',
      admin: { description: 'Optional override; falls back to the global Pricing tier values.' },
      fields: [
        { name: 'starterFee', type: 'number' },
        { name: 'businessFee', type: 'number' },
        { name: 'maintenanceYearly', type: 'number' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}
