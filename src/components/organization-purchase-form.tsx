'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react'

async function loadPaddleScript() {
  const browser = window as any
  if (browser.Paddle) return browser.Paddle
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paddle-js="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Could not load Paddle checkout.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    script.dataset.paddleJs = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Paddle checkout.'))
    document.head.appendChild(script)
  })
  if (!browser.Paddle) throw new Error('Paddle checkout did not initialize.')
  return browser.Paddle
}

function slugFromName(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

export function OrganizationPurchaseForm({ annualPriceMinor, currency, available, paddleClientToken, paddleEnvironment }: {
  annualPriceMinor: number
  currency: string
  available: boolean
  paddleClientToken: string
  paddleEnvironment: 'sandbox' | 'production'
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('+966')
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const price = useMemo(() => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(annualPriceMinor / 100), [annualPriceMinor, currency])

  useEffect(() => {
    if (!available || !paddleClientToken) return
    let cancelled = false
    void loadPaddleScript().then((paddle) => {
      if (cancelled) return
      const browser = window as any
      if (browser.__fleetPaddleInitialized) return
      if (paddleEnvironment === 'sandbox') paddle.Environment.set('sandbox')
      paddle.Initialize({
        token: paddleClientToken,
        eventCallback: (event: any) => {
          if (event?.name === 'checkout.error') setError(event?.data?.detail || 'Paddle could not open checkout. Please try again.')
        }
      })
      browser.__fleetPaddleInitialized = true
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load Paddle checkout.')
    })
    return () => { cancelled = true }
  }, [available, paddleClientToken, paddleEnvironment])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/billing/organizations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, ownerName, ownerEmail, phoneCountryCode, phone, agreedToRenewal: agree })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not start secure checkout.')
      if (result.provider === 'PADDLE' && result.paddle) {
        const paddle = await loadPaddleScript()
        const browser = window as any
        if (!browser.__fleetPaddleInitialized) {
          if (result.paddle.environment === 'sandbox') paddle.Environment.set('sandbox')
          paddle.Initialize({
            token: result.paddle.clientToken,
            eventCallback: (event: any) => {
              if (event?.name === 'checkout.error') setError(event?.data?.detail || 'Paddle could not open checkout. Please try again.')
            }
          })
          browser.__fleetPaddleInitialized = true
        }
        paddle.Checkout.open({
          items: [{ priceId: result.paddle.priceId, quantity: 1 }],
          customer: { email: result.paddle.customerEmail },
          customData: { organizationId: result.paddle.organizationId, attemptId: result.paddle.attemptId },
          settings: { successUrl: result.paddle.successUrl }
        })
        setSaving(false)
        return
      }
      if (!result.redirectUrl) throw new Error('Secure checkout did not return a payment link.')
      window.location.assign(result.redirectUrl)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start secure checkout.')
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 px-5 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"><ArrowLeft className="h-4 w-4" /> Annual plan</Link>
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-white/10 dark:bg-slate-900/85 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight">Set up your organization</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">After successful payment, Fleet Manager creates a separate database and sends the first administrator to the workspace sign-in.</p>
            {!available && <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">Secure checkout is not enabled yet. The app owner must finish payment provider setup before purchases can be accepted.</div>}
            {error && <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{error}</div>}
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="purchase-company">Organization name</label><input id="purchase-company" required maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(slugFromName(event.target.value)) }} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-white/15 dark:bg-slate-950" placeholder="Company name" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="purchase-code">Workspace code</label><input id="purchase-code" required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-')) }} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-white/15 dark:bg-slate-950" placeholder="company-name" /><p className="text-xs text-slate-500 dark:text-slate-400">This code is used when signing in to your workspace.</p></div>
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="purchase-admin">Administrator name</label><input id="purchase-admin" required maxLength={100} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-white/15 dark:bg-slate-950" placeholder="Full name" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="purchase-email">Administrator email</label><input id="purchase-email" required type="email" maxLength={254} value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-white/15 dark:bg-slate-950" placeholder="admin@company.com" /></div>
              <div className="grid grid-cols-[115px_1fr] gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="phone-code">Calling code</label><input id="phone-code" required value={phoneCountryCode} onChange={(event) => setPhoneCountryCode(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-white/15 dark:bg-slate-950" placeholder="+966" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="purchase-phone">Phone number</label><input id="purchase-phone" required inputMode="tel" pattern="[0-9]{7,14}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 14))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-white/15 dark:bg-slate-950" placeholder="5XXXXXXXX" /></div>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 dark:border-white/10 dark:bg-white/[0.03]">
                <input type="checkbox" required checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-blue-700" />
                <span>I authorize the annual plan to renew automatically through the payment provider. I can cancel renewal from workspace billing before the next renewal date. I agree to the <Link href="/agreement" target="_blank" className="font-medium text-blue-700 underline dark:text-blue-300">user agreement</Link>.</span>
              </label>
              <button type="submit" disabled={!available || saving || !agree} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white shadow-md shadow-blue-900/15 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-55">
                {saving ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Opening secure checkout…</> : <>Continue to secure checkout <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </section>
          <aside className="h-fit rounded-3xl border border-blue-200/80 bg-blue-50/75 p-6 dark:border-blue-300/10 dark:bg-blue-400/[0.05] sm:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> Secure annual plan</div>
            <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">Fleet Manager Pro · one organization</p>
            <p className="mt-1 text-3xl font-bold">{price}<span className="ms-1 text-sm font-medium text-slate-500 dark:text-slate-400">/ year</span></p>
            <div className="my-5 border-t border-blue-200 dark:border-white/10" />
            <div className="flex justify-between gap-4 text-sm"><span>Annual subscription</span><span>{price}</span></div>
            <div className="mt-2 flex justify-between gap-4 text-sm"><span>Billing frequency</span><span>Once per year</span></div>
            <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">The listed price uses the plan currency. Paddle may show a localized currency and applicable tax before payment. Checkout is hosted securely; Fleet Manager does not receive full card details.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}
