/**
 * Custom Payload endpoints — these are mounted under /api/* alongside the
 * auto-generated collection endpoints.
 *
 * All endpoints follow the same skeleton:
 *  1. Auth check (system token, machine token, or customer session)
 *  2. Validate input
 *  3. Use req.payload.* to perform the operation
 *  4. Return JSON
 */

import type { Endpoint } from 'payload'

import { releasesPostEndpoint } from './releases-post'
import { releasesLatestEndpoint } from './releases-latest'
import { downloadsTrackEndpoint } from './downloads-track'
import { paystackInitEndpoint } from './paystack-init'
import { paystackWebhookEndpoint } from './paystack-webhook'
import { paystackStatusEndpoint } from './paystack-status'
import { licensesValidateEndpoint } from './licenses-validate'
import { licensesActivateEndpoint } from './licenses-activate'
import { telemetryEventsEndpoint } from './telemetry-events'
import { telemetryHeartbeatEndpoint } from './telemetry-heartbeat'
import { customersMeEndpoint } from './customers-me'
import { supportTicketsReplyEndpoint } from './support-tickets-reply'
import { paymentsReceiptEndpoint } from './payments-receipt'

export const customEndpoints: Endpoint[] = [
  releasesPostEndpoint,
  releasesLatestEndpoint,
  downloadsTrackEndpoint,
  paystackInitEndpoint,
  paystackWebhookEndpoint,
  paystackStatusEndpoint,
  licensesValidateEndpoint,
  licensesActivateEndpoint,
  telemetryEventsEndpoint,
  telemetryHeartbeatEndpoint,
  customersMeEndpoint,
  supportTicketsReplyEndpoint,
  paymentsReceiptEndpoint,
]
