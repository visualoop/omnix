/**
 * /admin/customers/new — admin creates a customer without going through
 * the public signup flow.
 *
 * Only the organisation name is required. Email is optional (we synthesize
 * a placeholder for Better Auth's NOT NULL constraint). Admin can
 * optionally issue a 30-day trial licence in the same step.
 *
 * On success, the page shows the customer's login credentials + copy
 * buttons so the admin can pass them over WhatsApp/phone. The customer
 * signs in normally, then updates their email + password from
 * /dashboard/profile.
 */
import { PageHeader } from '@/components/layout/page-header'
import { NewCustomerForm } from './new-customer-form'

export const metadata = { title: 'New customer · Admin' }
export const dynamic = 'force-dynamic'

export default function NewCustomerPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Customers"
        title="Create customer account"
        description="For customers who bought via M-Pesa directly or don't want to give an email. You'll get a login PIN to pass them by WhatsApp; they sign in, use Omnix, and can add a real email later from their profile."
      />
      <NewCustomerForm />
    </div>
  )
}
