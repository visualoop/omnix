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
import { NewCustomerForm } from './new-customer-form'

export const metadata = { title: 'New customer · Admin' }
export const dynamic = 'force-dynamic'

export default function NewCustomerPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Create customer account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For customers who bought via M-Pesa directly or don&rsquo;t want to give an email.
          You&rsquo;ll get a login PIN to pass them by WhatsApp. They log in, use Omnix,
          and can add a real email later from their profile.
        </p>
      </div>
      <NewCustomerForm />
    </div>
  )
}
