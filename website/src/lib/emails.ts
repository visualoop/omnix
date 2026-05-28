import type { Payload } from 'payload'
import { render } from '@react-email/render'
import * as React from 'react'

import { TrialEnded } from '@/emails/trial-ended'
import { TrialEndingSoon } from '@/emails/trial-ending-soon'
import { LicenseIssued } from '@/emails/license-issued'
import { PaymentReceipt } from '@/emails/payment-receipt'
import { MaintenanceEndingSoon } from '@/emails/maintenance-ending-soon'
import { Welcome } from '@/emails/welcome'

const TEMPLATES = {
  Welcome,
  TrialEnded,
  TrialEndingSoon,
  LicenseIssued,
  PaymentReceipt,
  MaintenanceEndingSoon,
} as const

export type EmailTemplateName = keyof typeof TEMPLATES

export async function renderEmail<T extends EmailTemplateName>(
  name: T,
  props: React.ComponentProps<(typeof TEMPLATES)[T]>,
): Promise<string> {
  const Component = TEMPLATES[name] as React.ComponentType<typeof props>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(Component as any, props as any)
  return render(element)
}

export async function sendEmail({
  payload,
  to,
  subject,
  html,
  from,
}: {
  payload: Payload
  to: string
  subject: string
  html: string
  from?: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    payload.logger.info(`[email] (no RESEND_API_KEY) would send "${subject}" to ${to}`)
    return
  }
  try {
    await payload.sendEmail({
      to,
      from: from ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@omnix.co.ke',
      subject,
      html,
    })
  } catch (err) {
    payload.logger.error(
      { err, to, subject },
      `[email] failed to send`,
    )
  }
}
