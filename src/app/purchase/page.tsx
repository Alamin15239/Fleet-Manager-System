'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Building2, Check, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type BillingInterval = 'month' | 'year'
type PriceData = { amountMinor: number; currency: string; interval: BillingInterval }

function slugFromName(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

export default function PurchasePage() {
  const [prices, setPrices] = useState<Record<BillingInterval, PriceData | null>>({ month: null, year: null })
  const [interval, setInterval] = useState<BillingInterval>('year')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [callingCode, setCallingCode] = useState('+966')
  const [phone, setPhone] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loadingPrice, setLoadingPrice] = useState(true)
  const [wasCanceled, setWasCanceled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const price = prices[interval]
  const formattedPrice = useMemo(() => {
    if (!price) return ''
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency })
    return formatter.format(price.amountMinor / (10 ** formatter.resolvedOptions().maximumFractionDigits))
  }, [price])

  useEffect(() => {
    setWasCanceled(new URLSearchParams(window.location.search).get('cancelled') === '1')
    let active = true
    fetch('/api/billing/organizations/checkout', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Checkout is unavailable.')
        return data.prices as Record<BillingInterval, PriceData | null>
      })
      .then((value) => {
        if (!active) return
        setPrices(value)
        if (!value.year && value.month) setInterval('month')
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Checkout is unavailable.') })
      .finally(() => { if (active) setLoadingPrice(false) })
    return () => { active = false }
  }, [])

  const updateName = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(slugFromName(value))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/billing/organizations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, ownerName, ownerEmail, callingCode, phone, interval, acceptedTerms })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not start secure checkout.')
      if (!data.url || !String(data.url).startsWith('https://checkout.stripe.com/')) throw new Error('Stripe returned an invalid checkout URL.')
      window.location.assign(data.url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start secure checkout.')
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/60 px-4 py-10 text-slate-950 sm:py-14">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm"><Building2 className="h-4 w-4" /> Fleet Manager subscription</div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">A private fleet workspace for your organization</h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">Create a separate workspace with its own database and first administrator. Your organization’s fleet records stay isolated from every other customer.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Dedicated workspace', 'Your own organization code and fleet data.'],
              ['Separate database', 'A new isolated Neon database is provisioned after payment.'],
              ['Manage billing', 'Use Stripe’s secure portal to update or cancel renewal.']
            ].map(([title, detail]) => <div key={title} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm"><div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Check className="h-4 w-4" /></div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p></div>)}
          </div>
          <p className="flex items-start gap-2 text-sm text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Payment details are entered on Stripe’s hosted checkout page. They are not stored in Fleet Manager.</p>
        </section>

        <Card className="border-slate-200/80 shadow-xl shadow-slate-900/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Set up your organization</CardTitle>
            <CardDescription>Complete these details, then continue to Stripe’s secure checkout.</CardDescription>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-600">One organization · {interval === 'year' ? 'billed yearly' : 'billed monthly'}</div>
              <div className="mt-1 text-3xl font-semibold">{loadingPrice ? <span className="text-base text-slate-500">Loading prices…</span> : formattedPrice || 'Unavailable'}<span className="ms-1 text-base font-normal text-slate-500">/ {interval}</span></div>
              <p className="mt-1 text-xs text-slate-500">Renews {interval === 'year' ? 'yearly' : 'monthly'} until canceled. Stripe displays the final checkout amount before payment.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Billing interval</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['month', 'year'] as const).map((option) => {
                    const optionPrice = prices[option]
                    const optionLabel = option === 'month' ? 'Monthly' : 'Yearly'
                    const optionAmount = optionPrice
                      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: optionPrice.currency }).format(optionPrice.amountMinor / (10 ** new Intl.NumberFormat(undefined, { style: 'currency', currency: optionPrice.currency }).resolvedOptions().maximumFractionDigits))
                      : 'Unavailable'
                    return <button key={option} type="button" disabled={!optionPrice || loadingPrice} onClick={() => setInterval(option)} aria-pressed={interval === option} className={`rounded-xl border p-3 text-start transition ${interval === option ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 bg-white hover:border-indigo-300'} disabled:cursor-not-allowed disabled:opacity-50`}>
                      <span className="block text-sm font-semibold">{optionLabel}</span>
                      <span className="mt-1 block text-sm text-slate-600">{loadingPrice ? 'Loading…' : optionPrice ? `${optionAmount} / ${option}` : optionAmount}</span>
                    </button>
                  })}
                </div>
              </fieldset>
              <div className="space-y-1.5"><Label htmlFor="purchase-org-name">Organization name</Label><Input id="purchase-org-name" required maxLength={80} value={name} onChange={(event) => updateName(event.target.value)} placeholder="Company name" /></div>
              <div className="space-y-1.5"><Label htmlFor="purchase-org-code">Workspace code</Label><Input id="purchase-org-code" required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-')) }} placeholder="company-code" /><p className="text-xs text-slate-500">Your administrators and users will enter this code when signing in.</p></div>
              <div className="space-y-1.5"><Label htmlFor="purchase-admin-name">First administrator</Label><Input id="purchase-admin-name" required maxLength={100} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Full name" /></div>
              <div className="space-y-1.5"><Label htmlFor="purchase-admin-email">Administrator email</Label><Input id="purchase-admin-email" required type="email" maxLength={254} value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="admin@company.com" /></div>
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                <div className="space-y-1.5"><Label htmlFor="purchase-calling-code">Code</Label><Input id="purchase-calling-code" required value={callingCode} onChange={(event) => setCallingCode(event.target.value)} inputMode="tel" /></div>
                <div className="space-y-1.5"><Label htmlFor="purchase-phone">Phone number</Label><Input id="purchase-phone" required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5 text-slate-700">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" />
                <span>I authorize the {interval === 'year' ? 'yearly' : 'monthly'} plan to renew automatically. I can cancel renewal through workspace billing before the next renewal date, and I agree to the <a className="font-medium text-indigo-700 underline" href="/agreement" target="_blank" rel="noreferrer">User Agreement</a> and <a className="font-medium text-indigo-700 underline" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
              </label>
              {wasCanceled && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Checkout was canceled. Your organization database was not created.</p>}
              {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="w-full" disabled={loadingPrice || !price || submitting || !acceptedTerms}>
                {submitting ? <><LoaderCircle className="me-2 h-4 w-4 animate-spin" />Connecting to Stripe…</> : <>Continue to secure checkout<ArrowRight className="ms-2 h-4 w-4" /></>}
              </Button>
              <p className="text-center text-xs text-slate-500">Your database is provisioned only after a successful payment confirmation.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
