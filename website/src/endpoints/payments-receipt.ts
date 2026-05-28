import type { Endpoint } from 'payload'
import { errorResponse } from './_auth'
import { BRAND_NAME, BRAND } from '../lib/brand'

/**
 * GET /api/payments/:id/receipt
 * Returns an HTML receipt the customer can print or save as PDF.
 * Browser print-to-PDF gives us a compliant PDF without bundling a heavy
 * PDF library. Customer-authenticated.
 */
export const paymentsReceiptEndpoint: Endpoint = {
  path: '/payments/:id/receipt',
  method: 'get',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in required', 401)
    }
    const id = (req.routeParams?.id as string | undefined) ?? ''
    if (!id) return errorResponse('Missing payment id', 400)

    let payment
    try {
      payment = (await req.payload.findByID({
        collection: 'payments',
        id,
        depth: 1,
      })) as unknown as {
        id: string | number
        paystackReference: string
        customer: string | { id: string | number; fullName?: string; email?: string; businessName?: string; kraPin?: string }
        license?: string | { id: string | number; licenseKey?: string; tier?: string }
        amount: number
        currency: string
        netAmount?: number
        paystackFees?: number
        channel?: string
        purpose: string
        status: string
        paidAt?: string
        cardLast4?: string
        cardBrand?: string
        mpesaReceiptNumber?: string
      }
    } catch {
      return errorResponse('Payment not found', 404)
    }

    const ownerId = typeof payment.customer === 'string' ? payment.customer : payment.customer?.id
    if (String(ownerId) !== String(req.user.id)) {
      return errorResponse('Not your payment', 403)
    }

    if (payment.status !== 'success') {
      return errorResponse('No receipt for unsuccessful payment', 400)
    }

    const customer = typeof payment.customer === 'string' ? null : payment.customer
    const license = typeof payment.license === 'string' ? null : payment.license

    const html = renderReceipt({
      receipt: {
        ref: payment.paystackReference,
        date: payment.paidAt ?? new Date().toISOString(),
        purpose: payment.purpose.replace(/_/g, ' '),
        amount: payment.amount,
        currency: payment.currency,
        fees: payment.paystackFees ?? 0,
        net: payment.netAmount ?? payment.amount,
        channel: payment.channel ?? 'card',
        cardLast4: payment.cardLast4,
        cardBrand: payment.cardBrand,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
      },
      customer: {
        name: customer?.fullName ?? '—',
        email: customer?.email ?? '—',
        business: customer?.businessName ?? '—',
        kraPin: customer?.kraPin ?? '—',
      },
      license: license ? { key: license.licenseKey ?? '—', tier: license.tier ?? '—' } : null,
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    })
  },
}

function renderReceipt(args: {
  receipt: {
    ref: string
    date: string
    purpose: string
    amount: number
    currency: string
    fees: number
    net: number
    channel: string
    cardLast4?: string
    cardBrand?: string
    mpesaReceiptNumber?: string
  }
  customer: { name: string; email: string; business: string; kraPin: string }
  license: { key: string; tier: string } | null
}): string {
  const { receipt, customer, license } = args
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(n)
  const date = new Date(receipt.date).toLocaleString('en-KE', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const channelLine =
    receipt.channel === 'card' && receipt.cardLast4
      ? `${receipt.cardBrand ?? 'Card'} ··${receipt.cardLast4}`
      : receipt.channel === 'mpesa' && receipt.mpesaReceiptNumber
        ? `M-Pesa · ${receipt.mpesaReceiptNumber}`
        : receipt.channel

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt ${receipt.ref} — ${BRAND_NAME}</title>
<style>
  body { font: 13px/1.55 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1A1A1A; margin: 0; padding: 56px 64px; background: #fff; }
  h1 { font: 300 32px/1.1 Georgia, serif; margin: 0; letter-spacing: -.01em; }
  .brand-dot { display: inline-block; width: 8px; height: 8px; background: #C77B3F; border-radius: 999px; margin-left: 6px; vertical-align: middle; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .muted { color: #6B6B6B; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  td { padding: 10px 0; border-bottom: 1px solid #E8E8E8; vertical-align: top; }
  td.label { color: #6B6B6B; width: 200px; }
  td.value { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  .total td { border-top: 2px solid #1A1A1A; border-bottom: none; padding-top: 16px; font-weight: 600; font-size: 16px; }
  .footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid #E8E8E8; color: #6B6B6B; font-size: 11px; line-height: 1.5; }
  .stamp { color: #C77B3F; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; font-size: 11px; }
  @media print { body { padding: 24px 32px; } }
</style>
</head>
<body>
  <header class="row">
    <div>
      <h1>${BRAND_NAME}<span class="brand-dot"></span></h1>
      <div class="muted" style="margin-top:8px">Payment Receipt</div>
    </div>
    <div style="text-align: right;">
      <div class="stamp">Paid</div>
      <div class="muted" style="margin-top:8px">${date}</div>
      <div style="margin-top:4px; font-family: ui-monospace,monospace; font-size:11px;">Ref ${receipt.ref}</div>
    </div>
  </header>

  <table>
    <tr><td class="label">Billed to</td><td class="value">${escape(customer.business)}</td></tr>
    <tr><td class="label">Contact</td><td class="value">${escape(customer.name)} · ${escape(customer.email)}</td></tr>
    <tr><td class="label">KRA PIN</td><td class="value">${escape(customer.kraPin)}</td></tr>
    ${license ? `<tr><td class="label">Licence</td><td class="value">${escape(license.key)} (${escape(license.tier)})</td></tr>` : ''}
    <tr><td class="label">Purpose</td><td class="value" style="text-transform: capitalize;">${escape(receipt.purpose)}</td></tr>
    <tr><td class="label">Channel</td><td class="value">${escape(channelLine)}</td></tr>
    <tr><td class="label">Subtotal</td><td class="value">${receipt.currency} ${fmt(receipt.amount)}</td></tr>
    <tr><td class="label">Paystack fees</td><td class="value">${receipt.currency} ${fmt(receipt.fees)}</td></tr>
    <tr class="total"><td>Total paid</td><td class="value">${receipt.currency} ${fmt(receipt.amount)}</td></tr>
  </table>

  <div class="footer">
    Issued by SokoOS Technologies Ltd · KRA PIN P051234567A · Nairobi, Kenya<br />
    For billing questions: billing@${BRAND.domain}<br />
    <em>Use your browser's "Print → Save as PDF" to keep a copy.</em>
  </div>
</body>
</html>`
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

const channelLine = '' // satisfy unused-var fallthrough above
void channelLine
