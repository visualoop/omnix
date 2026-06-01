import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { ownerOrSupport } from '../access'

const generateTicketNumber: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || data.ticketNumber) return data
  const year = new Date().getFullYear()
  const count = await req.payload.count({
    collection: 'support-tickets',
  })
  const padded = String(count.totalDocs + 1).padStart(6, '0')
  data.ticketNumber = `OMNIX-T-${year}-${padded}`
  return data
}

export const SupportTickets: CollectionConfig = {
  slug: 'support-tickets',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['ticketNumber', 'subject', 'customer', 'status', 'priority', 'updatedAt'],
    description: 'Customer-raised support requests. Owner + support reply in-thread.',
  },
  access: {
    read: ({ req }) => {
      if (req.user?.collection === 'users') return true
      if (req.user?.collection === 'customers') {
        return { customer: { equals: req.user.id } }
      }
      return false
    },
    create: () => true,
    update: ({ req }) => {
      if (req.user?.collection === 'users') return true
      if (req.user?.collection === 'customers') {
        return { customer: { equals: req.user.id } }
      }
      return false
    },
    delete: ownerOrSupport,
  },
  hooks: {
    beforeChange: [generateTicketNumber],
  },
  fields: [
    {
      name: 'ticketNumber',
      type: 'text',
      unique: true,
      admin: { readOnly: true, description: 'Auto-generated. Format: OMNIX-T-YYYY-NNNNNN.' },
    },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true },
    { name: 'license', type: 'relationship', relationTo: 'licenses' },
    { name: 'machine', type: 'relationship', relationTo: 'machines' },
    { name: 'subject', type: 'text', required: true },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Bug', value: 'bug' },
        { label: 'Feature request', value: 'feature_request' },
        { label: 'Question', value: 'question' },
        { label: 'Billing', value: 'billing' },
        { label: 'Data recovery', value: 'data_recovery' },
        { label: 'Install help', value: 'install_help' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Awaiting customer', value: 'awaiting_customer' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' },
      ],
    },
    { name: 'description', type: 'richText' },
    {
      name: 'attachments',
      type: 'array',
      fields: [{ name: 'file', type: 'upload', relationTo: 'media' }],
    },
    {
      name: 'attachedDiagnosticId',
      type: 'relationship',
      relationTo: 'telemetry-events',
      admin: { description: 'Set when customer attached a manual diagnostic dump.' },
    },
    {
      name: 'thread',
      type: 'array',
      fields: [
        {
          name: 'sender',
          type: 'select',
          options: [
            { label: 'Customer', value: 'customer' },
            { label: 'Support', value: 'support' },
            { label: 'Owner', value: 'owner' },
            { label: 'System', value: 'system' },
          ],
        },
        { name: 'senderName', type: 'text' },
        { name: 'body', type: 'richText' },
        {
          name: 'attachments',
          type: 'array',
          fields: [{ name: 'file', type: 'upload', relationTo: 'media' }],
        },
        {
          name: 'sentAt',
          type: 'date',
          defaultValue: () => new Date().toISOString(),
        },
      ],
    },
    { name: 'assignedTo', type: 'relationship', relationTo: 'users' },
    { name: 'resolvedAt', type: 'date' },
    {
      name: 'satisfactionRating',
      type: 'number',
      min: 1,
      max: 5,
      admin: { description: 'Customer rating after ticket closure (1–5 stars).' },
    },
  ],
}
