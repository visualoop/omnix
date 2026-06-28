/**
 * /pro was the public landing for the all-trades "Omnix Pro" variant.
 *
 * As of v0.16.1 we stopped selling Pro publicly — the four trade modules
 * (Dawa, Retail, Hospitality, Hardware) are the only buyable options on
 * the marketing site. Existing Pro licensees keep access via their
 * dashboard (where the Pro installer is still listed under
 * /dashboard/downloads).
 *
 * We redirect rather than 404 so:
 *   - inbound links + past Google index entries still resolve,
 *   - search engines learn the destination (permanent 308),
 *   - users land on the modules grid where they self-select a trade.
 */
import { redirect } from 'next/navigation'

export default function ProPage() {
  redirect('/modules')
}
