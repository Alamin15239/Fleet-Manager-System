'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck, Truck } from 'lucide-react'

const productUrl = process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL || 'https://alaminkhan7.gumroad.com/l/ahdyo'

function normalizeWorkspaceCode(value: string) {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

export default function PurchasePage() {
  const [organizationName, setOrganizationName] = useState('')
  const [workspaceCode, setWorkspaceCode] = useState('')
  const [administratorName, setAdministratorName] = useState('')
  const [administratorEmail, setAdministratorEmail] = useState('')
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')
  const [error, setError] = useState('')

  function continueToCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const code = normalizeWorkspaceCode(workspaceCode || organizationName)
    if (organizationName.trim().length < 2) return setError('Enter your organization name.')
    if (code.length < 2) return setError('Choose a workspace code with at least 2 letters or numbers.')
    if (administratorName.trim().length < 2) return setError('Enter the administrator name.')
    if (!/^\S+@\S+\.\S+$/.test(administratorEmail.trim())) return setError('Enter a valid administrator email.')

    const checkout = new URL(productUrl)
    checkout.searchParams.set('wanted', 'true')
    checkout.searchParams.set(billing, 'true')
    checkout.searchParams.set('email', administratorEmail.trim())
    checkout.searchParams.set('Organization Name', organizationName.trim())
    checkout.searchParams.set('Workspace Code', code)
    checkout.searchParams.set('Administrator Name', administratorName.trim())
    window.location.assign(checkout.toString())
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 px-4 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 font-bold tracking-tight">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-900/15"><Truck className="h-5 w-5" /></span>
            <span>Fleet Manager Pro</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Sign in</Link>
        </header>

        <section className="grid overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 lg:grid-cols-[1.1fr_.9fr]">
          <div className="p-6 sm:p-10">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[.15em] text-blue-700 dark:text-blue-300">Start your workspace</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Fleet management for your organization</h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-600 dark:text-slate-300">Choose a monthly or yearly membership, then complete secure checkout on Gumroad. After payment is confirmed, Fleet Manager creates a separate database and workspace for your company.</p>

            <form className="mt-8 space-y-5" onSubmit={continueToCheckout}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium sm:col-span-2">Organization name
                  <input required minLength={2} maxLength={80} value={organizationName} onChange={event => setOrganizationName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950" placeholder="Your company" />
                </label>
                <label className="block text-sm font-medium">Workspace code
                  <input required minLength={2} maxLength={48} value={workspaceCode} onChange={event => setWorkspaceCode(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950" placeholder="your-company" />
                  <span className="mt-1 block text-xs text-slate-500">Used in your sign-in link. Letters, numbers, and hyphens.</span>
                </label>
                <div className="block text-sm font-medium">Billing frequency
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-950">
                    {(['monthly', 'yearly'] as const).map(option => <button key={option} type="button" onClick={() => setBilling(option)} aria-pressed={billing === option} className={`rounded-lg px-3 py-2.5 text-sm font-semibold capitalize transition ${billing === option ? 'bg-blue-700 text-white shadow' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10'}`}>{option}</button>)}
                  </div>
                </div>
                <label className="block text-sm font-medium">Administrator name
                  <input required minLength={2} maxLength={100} value={administratorName} onChange={event => setAdministratorName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950" placeholder="First administrator" />
                </label>
                <label className="block text-sm font-medium">Administrator email
                  <input required type="email" maxLength={254} value={administratorEmail} onChange={event => setAdministratorEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950" placeholder="admin@company.com" />
                  <span className="mt-1 block text-xs text-slate-500">Use this same email at Gumroad checkout.</span>
                </label>
              </div>

              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/25">
                Continue to secure checkout <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-center text-xs leading-5 text-slate-500">Checkout is hosted by Gumroad. The membership renews at the selected frequency until canceled through Gumroad.</p>
            </form>
          </div>

          <aside className="flex flex-col justify-between bg-gradient-to-br from-blue-700 to-cyan-700 p-6 text-white sm:p-10">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Separate organization workspace</div>
              <h2 className="text-2xl font-bold">A fresh, private fleet workspace</h2>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-blue-50">
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> Each organization receives its own Neon database.</li>
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> Your first administrator is created after verified payment.</li>
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> Choose monthly or yearly billing on this page.</li>
              </ul>
            </div>
            <div className="mt-10 border-t border-white/20 pt-5 text-sm text-blue-50">
              <p>Already paid? Open the sign-in page and enter your workspace code.</p>
              <Link href="/login" className="mt-3 inline-flex items-center gap-2 font-semibold text-white hover:underline">Go to sign in <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </aside>
        </section>

        <footer className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <Link href="/agreement" className="hover:text-blue-700">User agreement</Link>
          <Link href="/privacy" className="hover:text-blue-700">Privacy policy</Link>

        </footer>
      </div>
    </main>
  )
}
