import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Building2, CircleDot, ClipboardCheck, FileText, ShieldCheck, Truck, Wrench } from 'lucide-react'
import { annualOrganizationPriceSar, isOrganizationBillingReady, organizationBillingProvider } from '@/lib/organization-billing'
import { getConfiguredPaddlePrice } from '@/lib/paddle-billing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Annual Fleet Management Plan | Fleet Manager Pro',
  description: 'One annual Fleet Manager Pro workspace for truck and trailer records, maintenance, job cards, tires, documents, invoices, and reports.'
}

const included = [
  { icon: Truck, title: 'Truck and trailer records' },
  { icon: Wrench, title: 'Maintenance and workshop job cards' },
  { icon: CircleDot, title: 'Tire and oil change tracking' },
  { icon: FileText, title: 'Vehicle expenses, VAT, and reports' },
  { icon: ShieldCheck, title: 'Expiry tracking and role permissions' },
  { icon: ClipboardCheck, title: 'A separate company workspace and database' }
]

export default async function PricingPage() {
  const provider = organizationBillingProvider()
  const ready = isOrganizationBillingReady()
  let priceMinor = annualOrganizationPriceSar() * 100
  let currency = 'SAR'
  if (provider === 'PADDLE' && ready) {
    try {
      const paddlePrice = await getConfiguredPaddlePrice()
      priceMinor = Number(paddlePrice.unit_price?.amount)
      currency = String(paddlePrice.unit_price?.currency_code || 'USD').toUpperCase()
    } catch (error) {
      console.error('Paddle annual price could not be loaded for pricing page:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
  const price = new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(priceMinor / 100)
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 px-5 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between gap-3">
          <Link href="/" className="font-bold tracking-tight">Fleet Manager Pro</Link>
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-white/10">Sign in</Link>
        </header>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Annual fleet plan</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">A dedicated workspace for your fleet</h1>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">Manage your vehicles, workshop records, costs, documents, and reports in one organization workspace.</p>
        </div>

        <section className="mx-auto mt-9 grid max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 shadow-xl shadow-blue-950/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/85 md:grid-cols-[1fr_1.05fr]">
          <div className="bg-gradient-to-br from-blue-800 to-slate-950 p-7 text-white sm:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Building2 className="h-6 w-6" /></div>
            <h2 className="mt-6 text-2xl font-bold">Organization plan</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">One annual subscription creates a separate workspace and provisions an isolated fleet database after payment.</p>
            <div className="mt-8 flex items-end gap-2">
              <span className="text-4xl font-bold">{price}</span>
              <span className="pb-1 text-sm text-blue-100">/ year</span>
            </div>
            <p className="mt-2 text-xs text-blue-100">Annual auto-renewal. Cancel renewal from the workspace billing page. Tax and localized currency are shown at checkout.</p>
            <Link href="/purchase" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-blue-900 transition hover:bg-blue-50">
              Purchase annual plan <ArrowRight className="h-4 w-4" />
            </Link>
            {!ready && <p className="mt-3 text-center text-xs text-blue-100">Online checkout is being configured. You can still review the plan.</p>}
          </div>
          <div className="p-7 sm:p-9">
            <h3 className="text-lg font-semibold">Included in the annual plan</h3>
            <ul className="mt-5 space-y-4">
              {included.map(({ icon: Icon, title }) => (
                <li key={title} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Icon className="h-4 w-4" /></span>
                  <span>{title}</span>
                  <BadgeCheck className="ms-auto h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                </li>
              ))}
            </ul>
            <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm leading-6 text-blue-950 dark:border-blue-300/10 dark:bg-blue-400/5 dark:text-blue-100">
              Your fleet records stay separate from other organizations. The plan renews annually until the organization administrator cancels it.
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Payments are processed through secure hosted checkout. Fleet Manager does not collect or store full card details.</p>
          </div>
        </section>
        <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">Questions about a larger fleet? <a className="font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300" href="mailto:alaminkhan.xiaomi@gmail.com">Contact us</a>.</p>
      </div>
    </main>
  )
}
