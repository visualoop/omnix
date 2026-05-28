import type { CollectionConfig } from 'payload'
import { ownerOnly } from '../access'

/**
 * Pages — long-form public pages: privacy, terms, refund policy,
 * about, comparisons. NOT used for landing or pricing (those have
 * dedicated globals).
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'kind', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ownerOnly,
    update: ownerOnly,
    delete: ownerOnly,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL path segment, e.g. "privacy" → /privacy.',
      },
    },
    {
      name: 'kind',
      type: 'select',
      options: [
        { label: 'Legal', value: 'legal' },
        { label: 'Help / docs', value: 'help' },
        { label: 'About', value: 'about' },
        { label: 'Compare', value: 'compare' },
      ],
    },
    { name: 'body', type: 'richText' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'lastReviewedAt',
      type: 'date',
      admin: { description: 'Manually set after each editorial review pass.' },
    },
  ],
}
