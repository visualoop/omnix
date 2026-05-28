import type { CollectionConfig } from 'payload'
import { ownerOnly, ownerOrSupport } from '../access'

/**
 * TelemetryEvents — append-only log of everything machines report.
 *
 * Used for debugging, adoption analytics, support investigation.
 * 90-day retention for debug/info, 1-year for errors (cron, separate file).
 *
 * Permissioning: any machine (with valid token) can write its own events.
 * Only owner/support can read or modify.
 */
export const TelemetryEvents: CollectionConfig = {
  slug: 'telemetry-events',
  admin: {
    useAsTitle: 'eventType',
    defaultColumns: ['eventType', 'machine', 'severity', 'createdAt'],
    description: 'Anonymous diagnostic events from desktop installs. No business data.',
    pagination: {
      defaultLimit: 50,
      limits: [25, 50, 100, 250],
    },
  },
  access: {
    read: ownerOrSupport,
    create: () => true, // machine writes via token-authenticated endpoint
    update: ownerOnly,
    delete: ownerOnly,
  },
  fields: [
    {
      name: 'machine',
      type: 'relationship',
      relationTo: 'machines',
      required: true,
    },
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        { label: 'app_started', value: 'app_started' },
        { label: 'app_closed', value: 'app_closed' },
        { label: 'heartbeat', value: 'heartbeat' },
        { label: 'sync_completed', value: 'sync_completed' },
        { label: 'sale_completed', value: 'sale_completed' },
        { label: 'license_validated', value: 'license_validated' },
        { label: 'license_invalid', value: 'license_invalid' },
        { label: 'license_expired', value: 'license_expired' },
        { label: 'crash', value: 'crash' },
        { label: 'panic', value: 'panic' },
        { label: 'db_error', value: 'db_error' },
        { label: 'migration_error', value: 'migration_error' },
        { label: 'integration_error', value: 'integration_error' },
        { label: 'updater_check', value: 'updater_check' },
        { label: 'updater_download', value: 'updater_download' },
        { label: 'updater_installed', value: 'updater_installed' },
        { label: 'manual_diagnostic', value: 'manual_diagnostic' },
        { label: 'feedback_submitted', value: 'feedback_submitted' },
      ],
    },
    {
      name: 'severity',
      type: 'select',
      defaultValue: 'info',
      options: [
        { label: 'Debug', value: 'debug' },
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warn' },
        { label: 'Error', value: 'error' },
        { label: 'Fatal', value: 'fatal' },
      ],
    },
    { name: 'appVersion', type: 'text' },
    { name: 'message', type: 'textarea' },
    {
      name: 'stackTrace',
      type: 'code',
      admin: { language: 'text' },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Arbitrary structured data. Sanitiser on the desktop side strips anything resembling business data before sending.',
      },
    },
    { name: 'sessionId', type: 'text' },
    { name: 'ipAddress', type: 'text' },
  ],
  timestamps: true,
}
