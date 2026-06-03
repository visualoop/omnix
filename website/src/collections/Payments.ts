import type { CollectionConfig } from 'payload'
import { allowSystem, ownerOnly } from '../access'

/**
 * Payments — every Paystack transaction.
 * Source of truth for revenue. Created by webhook (system) or owner manually.
 */
export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    useAsTitle: 'paystackReference',
    defaultColumns: ['paystackReference', 'customer', 'amount', 'status', 'createdAt'],
    description: 'Paystack transactions. Source of truth for all revenue.',
  },
  access: {
    read: ({ req }) => {
      if (req.user?.collection === 'users') return true
      if (req.user?.collection === 'customers') {
        return { customer: { equals: req.user.id } }
      }
      return false
    },
    create: ({ req }) => allowSystem(req) || (req.user?.collection === 'users' && (req.user as unknown as { role?: string }).role === 'owner'), // server endpoints use overrideAccess; public create is blocked
    update: ownerOnly,
    delete: ownerOnly,
  },
  fields: [
    { name: 'paystackReference', type: 'text', required: true, unique: true },
    { name: 'paystackTransactionId', type: 'text' },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true },
    { name: 'license', type: 'relationship', relationTo: 'licenses' },

    // ── Money ──────────────────────────────────────────────────
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: { description: 'Total charged, in the currency below.' },
    },
    { name: 'currency', type: 'text', defaultValue: 'KES' },
    { name: 'paystackFees', type: 'number' },
    { name: 'netAmount', type: 'number', admin: { description: 'Amount minus Paystack fees.' } },

    // ── Method ─────────────────────────────────────────────────
    {
      name: 'channel',
      type: 'select',
      options: [
        { label: 'Card', value: 'card' },
        { label: 'M-Pesa', value: 'mpesa' },
        { label: 'Bank transfer', value: 'bank_transfer' },
        { label: 'Apple Pay', value: 'apple_pay' },
        { label: 'Mobile money (other)', value: 'mobile_money' },
      ],
    },
    { name: 'mpesaReceiptNumber', type: 'text' },
    { name: 'cardLast4', type: 'text' },
    { name: 'cardBrand', type: 'text' },

    // ── Purpose ────────────────────────────────────────────────
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'License fee (one-time)', value: 'license_fee' },
        { label: 'Maintenance renewal', value: 'maintenance_renewal' },
        { label: 'Major version upgrade', value: 'major_upgrade' },
        { label: 'Cloud backup (monthly)', value: 'cloud_backup' },
        { label: 'Extra branch', value: 'extra_branch' },
        { label: 'Extra machine seat', value: 'extra_machine' },
      ],
    },

    // ── Status ─────────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
        { label: 'Reversed', value: 'reversed' },
        { label: 'Refunded', value: 'refunded' },
      ],
    },
    { name: 'failureReason', type: 'text' },

    // ── Refund metadata ────────────────────────────────────────
    { name: 'refundedAt', type: 'date' },
    { name: 'refundReason', type: 'textarea' },
    { name: 'refundedBy', type: 'relationship', relationTo: 'users' },

    // ── Audit ──────────────────────────────────────────────────
    { name: 'paidAt', type: 'date' },
    {
      name: 'rawWebhookPayload',
      type: 'json',
      admin: { readOnly: true, hidden: true, description: 'Full Paystack payload for forensics.' },
    },
  ],
}
